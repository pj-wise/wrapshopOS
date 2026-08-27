import "server-only";

import { bpsToRate, roundToCent, type Cents } from "@/lib/money";

/**
 * PricingEngine — pure functions. Given a service definition + optional
 * vehicle + line options, produce a `PricedLineItem` that populates a quote.
 *
 * Kept free of Prisma + I/O so it's trivially unit-testable and can be reused
 * on both server (draft price on save) and portal (preview optional upsells).
 *
 * Pricing models supported:
 *   - `flat`     — service.priceCents × quantity
 *   - `coverage` — service.priceCents (per sqft) × coverage sqft
 *   - `hourly`   — service.hourlyRateCents × hours
 *   - `matrix`   — legacy vehicle-size map: service.matrixJson[vehicleSize] × quantity
 *                  with fallback to `priceCents` when the size isn't in the matrix.
 *   - `variable` — matrixJson holds { variableType, variableLabel, options }.
 *                  overrides.variableOptionKey picks which option; falls back
 *                  to the first option or `priceCents` if neither resolves.
 *
 * Labor: when service.productOnly is false and service.laborCostCents is set,
 * the labor cost is added on top of the resolved unit price so the customer
 * total = product + labor. Both pieces are exposed via `meta` for breakdown.
 *
 * All discounts here are LINE-LEVEL (percent or fixed cents). Order-level
 * discounts are applied outside the engine in `quoteTotals`.
 */

export type PricingModel = "flat" | "coverage" | "hourly" | "matrix" | "variable";

export type VehicleSize = "compact" | "sedan" | "coupe" | "suv" | "truck" | "van" | "exotic";

/** Shape stored under matrixJson when pricingModel === "variable". */
export type VariablePricingJson = {
  variableType: "vehicle_size" | "longevity" | "custom";
  variableLabel: string;
  showOptionDescriptions?: boolean;
  options: Array<{
    key: string;
    label: string;
    priceCents: number;
    description?: string;
  }>;
};

export type ServiceForPricing = {
  id: string;
  name: string;
  pricingModel: PricingModel;
  priceCents: number;
  /** Optional labor component added onto every model's unit price. */
  laborCostCents: number | null;
  productOnly: boolean;
  hourlyRateCents: number | null;
  estimatedHours: number | null;
  defaultCoverageSqft: number | null;
  /**
   * Two shapes tolerated: legacy `{ sedan: 3500, suv: 4200, ... }` for the
   * "matrix" model, and `VariablePricingJson` for the "variable" model.
   */
  matrixJson: unknown;
  taxable: boolean;
};

export type PricingOverrides = {
  /** Explicit coverage in sqft (overrides service.defaultCoverageSqft). */
  coverageSqft?: number;
  /** Explicit hours (overrides service.estimatedHours). */
  hours?: number;
  /** Vehicle size for legacy matrix pricing. */
  vehicleSize?: VehicleSize;
  /** Selected option key for "variable" pricing. */
  variableOptionKey?: string;
  /** Absolute quantity for "flat" and "matrix" (default 1). */
  quantity?: number;
  /** Line discount — either percent (0-100) or fixed cents. */
  discountPercent?: number;
  discountCents?: number;
  /** Force taxable state; falls back to service.taxable. */
  taxable?: boolean;
};

export type PricedLineItem = {
  description: string;
  quantity: number;
  unit: "each" | "sqft" | "linear_ft" | "hour";
  unitPriceCents: Cents;
  discountCents: Cents;
  subtotalCents: Cents; // qty * unit
  totalCents: Cents; // subtotal - discount
  taxable: boolean;
  meta: Record<string, unknown>;
};

const MAX_UNIT_CENTS = 100_000_000; // sanity ceiling — $1M/unit

/** Narrow arbitrary matrixJson into VariablePricingJson (or null). */
function readVariablePricing(raw: unknown): VariablePricingJson | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.variableType !== "string") return null;
  if (typeof obj.variableLabel !== "string") return null;
  if (!Array.isArray(obj.options)) return null;
  const options = obj.options.flatMap((o: unknown) => {
    if (!o || typeof o !== "object") return [];
    const rec = o as Record<string, unknown>;
    if (
      typeof rec.key !== "string" ||
      typeof rec.label !== "string" ||
      typeof rec.priceCents !== "number"
    ) {
      return [];
    }
    return [
      {
        key: rec.key,
        label: rec.label,
        priceCents: rec.priceCents,
        description: typeof rec.description === "string" ? rec.description : undefined,
      },
    ];
  });
  if (options.length === 0) return null;
  return {
    variableType: obj.variableType as VariablePricingJson["variableType"],
    variableLabel: obj.variableLabel,
    showOptionDescriptions:
      typeof obj.showOptionDescriptions === "boolean"
        ? obj.showOptionDescriptions
        : undefined,
    options,
  };
}

export function priceLine(
  service: ServiceForPricing,
  overrides: PricingOverrides = {},
): PricedLineItem {
  const quantity = overrides.quantity ?? 1;
  if (quantity <= 0) throw new Error("quantity must be > 0");

  let unit: PricedLineItem["unit"] = "each";
  let unitPriceCents = 0;
  let effectiveQty = quantity;
  const meta: Record<string, unknown> = { pricingModel: service.pricingModel };

  switch (service.pricingModel) {
    case "flat": {
      unitPriceCents = service.priceCents;
      break;
    }
    case "coverage": {
      const sqft = overrides.coverageSqft ?? service.defaultCoverageSqft ?? 0;
      if (sqft <= 0) {
        throw new Error(
          `Service "${service.name}" is coverage-priced but no coverageSqft supplied and no default set.`,
        );
      }
      unit = "sqft";
      unitPriceCents = service.priceCents;
      effectiveQty = sqft * quantity;
      meta.coverageSqft = sqft;
      break;
    }
    case "hourly": {
      const hours = overrides.hours ?? service.estimatedHours ?? 0;
      if (hours <= 0) {
        throw new Error(
          `Service "${service.name}" is hourly but no hours supplied and no estimatedHours set.`,
        );
      }
      if (service.hourlyRateCents == null) {
        throw new Error(
          `Service "${service.name}" is hourly but has no hourlyRateCents configured.`,
        );
      }
      unit = "hour";
      unitPriceCents = service.hourlyRateCents;
      effectiveQty = hours * quantity;
      meta.hours = hours;
      break;
    }
    case "matrix": {
      const size = overrides.vehicleSize;
      const legacyMatrix = (service.matrixJson ?? {}) as Partial<
        Record<VehicleSize, number>
      >;
      const matrixPrice = size ? legacyMatrix[size] : undefined;
      unitPriceCents = matrixPrice ?? service.priceCents;
      meta.vehicleSize = size ?? null;
      meta.matrixResolved = matrixPrice != null;
      break;
    }
    case "variable": {
      const cfg = readVariablePricing(service.matrixJson);
      const requestedKey = overrides.variableOptionKey;
      const selected =
        (requestedKey && cfg?.options.find((o) => o.key === requestedKey)) ||
        cfg?.options[0] ||
        null;
      unitPriceCents = selected?.priceCents ?? service.priceCents;
      meta.variableType = cfg?.variableType ?? null;
      meta.variableLabel = cfg?.variableLabel ?? null;
      meta.variableOptionKey = selected?.key ?? null;
      meta.variableOptionLabel = selected?.label ?? null;
      meta.variableResolved = selected != null;
      break;
    }
  }

  // Labor cost is added onto the resolved unit price when the service isn't
  // marked product-only. This is what makes the customer total = product +
  // labor; the pieces are exposed via `meta.baseUnitPriceCents` +
  // `meta.laborCostCents` for downstream breakdown displays.
  const baseUnitPriceCents = unitPriceCents;
  const laborCostCents = service.productOnly ? 0 : service.laborCostCents ?? 0;
  unitPriceCents = baseUnitPriceCents + laborCostCents;
  meta.baseUnitPriceCents = baseUnitPriceCents;
  meta.laborCostCents = laborCostCents;
  meta.productOnly = service.productOnly;

  if (!Number.isFinite(unitPriceCents) || unitPriceCents < 0) {
    throw new Error(`Invalid unit price for service "${service.name}": ${unitPriceCents}`);
  }
  if (unitPriceCents > MAX_UNIT_CENTS) {
    throw new Error(
      `Unit price exceeds sanity ceiling for service "${service.name}": ${unitPriceCents}`,
    );
  }

  const subtotalCents = roundToCent(unitPriceCents * effectiveQty);

  let discountCents = 0;
  if (overrides.discountPercent != null) {
    if (overrides.discountPercent < 0 || overrides.discountPercent > 100) {
      throw new Error("discountPercent must be 0-100");
    }
    discountCents = roundToCent((subtotalCents * overrides.discountPercent) / 100);
  } else if (overrides.discountCents != null) {
    if (overrides.discountCents < 0) throw new Error("discountCents must be >= 0");
    discountCents = Math.min(overrides.discountCents, subtotalCents);
  }

  const totalCents = subtotalCents - discountCents;

  return {
    description: service.name,
    quantity: effectiveQty,
    unit,
    unitPriceCents,
    discountCents,
    subtotalCents,
    totalCents,
    taxable: overrides.taxable ?? service.taxable,
    meta,
  };
}

// ============================================================================
// Order totals
// ============================================================================

export type QuoteTotalsInput = {
  lines: Array<{
    subtotalCents: Cents;
    discountCents: Cents;
    totalCents: Cents;
    taxable: boolean;
  }>;
  /** Order-level discount in absolute cents. */
  orderDiscountCents?: Cents;
  /** Order-level discount as percent (0-100). Applied AFTER cents discount. */
  orderDiscountPercent?: number;
  /** Sales tax rate in basis points. 875 = 8.75%. */
  taxRateBps?: number;
  /** Fixed cents deposit. Wins over percent if both set. */
  depositCents?: Cents;
  depositPercent?: number;
};

export type QuoteTotals = {
  subtotalCents: Cents;
  lineDiscountCents: Cents;
  orderDiscountCents: Cents;
  taxableCents: Cents;
  taxCents: Cents;
  totalCents: Cents;
  depositCents: Cents;
  balanceCents: Cents;
};

export function computeQuoteTotals(input: QuoteTotalsInput): QuoteTotals {
  const subtotalCents = input.lines.reduce((sum, l) => sum + l.subtotalCents, 0);
  const lineDiscountCents = input.lines.reduce((sum, l) => sum + l.discountCents, 0);
  const linesAfterLineDiscount = subtotalCents - lineDiscountCents;

  let orderDiscountCents = 0;
  if (input.orderDiscountCents) {
    orderDiscountCents += Math.min(input.orderDiscountCents, linesAfterLineDiscount);
  }
  if (input.orderDiscountPercent) {
    if (input.orderDiscountPercent < 0 || input.orderDiscountPercent > 100) {
      throw new Error("orderDiscountPercent must be 0-100");
    }
    const remaining = linesAfterLineDiscount - orderDiscountCents;
    orderDiscountCents += roundToCent((remaining * input.orderDiscountPercent) / 100);
  }

  const afterAllDiscounts = linesAfterLineDiscount - orderDiscountCents;

  // Tax applies only to lines flagged taxable, scaled by (afterAllDiscounts / subtotalAfterLineDiscount).
  // We approximate by proportionally allocating order discount across taxable lines.
  const taxableSubtotal = input.lines
    .filter((l) => l.taxable)
    .reduce((sum, l) => sum + l.totalCents, 0);
  const ratio = linesAfterLineDiscount > 0 ? afterAllDiscounts / linesAfterLineDiscount : 1;
  const taxableAfterDiscounts = roundToCent(taxableSubtotal * ratio);

  const taxRate = input.taxRateBps ? bpsToRate(input.taxRateBps) : 0;
  const taxCents = roundToCent(taxableAfterDiscounts * taxRate);

  const totalCents = afterAllDiscounts + taxCents;

  let depositCents = 0;
  if (input.depositCents) {
    depositCents = Math.min(input.depositCents, totalCents);
  } else if (input.depositPercent) {
    if (input.depositPercent < 0 || input.depositPercent > 100) {
      throw new Error("depositPercent must be 0-100");
    }
    depositCents = roundToCent((totalCents * input.depositPercent) / 100);
  }

  return {
    subtotalCents,
    lineDiscountCents,
    orderDiscountCents,
    taxableCents: taxableAfterDiscounts,
    taxCents,
    totalCents,
    depositCents,
    balanceCents: totalCents - depositCents,
  };
}
