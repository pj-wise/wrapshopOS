import { describe, expect, it } from "vitest";

import {
  computeQuoteTotals,
  priceLine,
  type ServiceForPricing,
} from "@/server/services/pricing";
import { centsFromDollars } from "@/lib/money";

// ---------------------------------------------------------------------------
// Test fixtures — realistic restyling services.
// ---------------------------------------------------------------------------

const CERAMIC_L2: ServiceForPricing = {
  id: "svc-ceramic-l2",
  name: "Ceramic Coating Level 2 (3yr)",
  pricingModel: "flat",
  priceCents: centsFromDollars(900),
  hourlyRateCents: null,
  estimatedHours: null,
  defaultCoverageSqft: null,
  matrixJson: {},
  taxable: true,
  laborCostCents: null,
  productOnly: false,
};

const FULL_FRONT_PPF: ServiceForPricing = {
  id: "svc-ppf-full-front",
  name: "Full Front PPF",
  // $32/sqft, default 60 sqft coverage
  pricingModel: "coverage",
  priceCents: centsFromDollars(32),
  hourlyRateCents: null,
  estimatedHours: null,
  defaultCoverageSqft: 60,
  matrixJson: {},
  taxable: true,
  laborCostCents: null,
  productOnly: false,
};

const CUSTOM_LABOR: ServiceForPricing = {
  id: "svc-labor",
  name: "Custom disassembly labor",
  pricingModel: "hourly",
  priceCents: 0,
  hourlyRateCents: centsFromDollars(125),
  estimatedHours: 4,
  defaultCoverageSqft: null,
  matrixJson: {},
  taxable: false,
  laborCostCents: null,
  productOnly: false,
};

const FULL_COLOR_CHANGE_WRAP: ServiceForPricing = {
  id: "svc-wrap-full",
  name: "Full Color Change Wrap",
  pricingModel: "matrix",
  priceCents: centsFromDollars(3500), // fallback for un-mapped sizes
  hourlyRateCents: null,
  estimatedHours: null,
  defaultCoverageSqft: null,
  matrixJson: {
    sedan: centsFromDollars(3500),
    coupe: centsFromDollars(3200),
    suv: centsFromDollars(4200),
    truck: centsFromDollars(4600),
    exotic: centsFromDollars(6500),
  },
  taxable: true,
  laborCostCents: null,
  productOnly: false,
};

// ---------------------------------------------------------------------------
// priceLine
// ---------------------------------------------------------------------------

describe("priceLine — flat", () => {
  it("returns the flat price at qty 1", () => {
    const line = priceLine(CERAMIC_L2);
    expect(line.totalCents).toBe(centsFromDollars(900));
    expect(line.unit).toBe("each");
    expect(line.quantity).toBe(1);
    expect(line.taxable).toBe(true);
  });

  it("scales linearly with quantity", () => {
    const line = priceLine(CERAMIC_L2, { quantity: 3 });
    expect(line.subtotalCents).toBe(centsFromDollars(2700));
    expect(line.totalCents).toBe(centsFromDollars(2700));
  });

  it("applies percent discount", () => {
    const line = priceLine(CERAMIC_L2, { discountPercent: 10 });
    expect(line.discountCents).toBe(centsFromDollars(90));
    expect(line.totalCents).toBe(centsFromDollars(810));
  });

  it("applies fixed cents discount (capped at subtotal)", () => {
    const line = priceLine(CERAMIC_L2, { discountCents: centsFromDollars(1500) });
    // Discount capped at $900 subtotal.
    expect(line.discountCents).toBe(centsFromDollars(900));
    expect(line.totalCents).toBe(0);
  });
});

describe("priceLine — coverage (PPF)", () => {
  it("uses default coverage when not supplied", () => {
    const line = priceLine(FULL_FRONT_PPF);
    // 60 sqft × $32 = $1920
    expect(line.subtotalCents).toBe(centsFromDollars(1920));
    expect(line.unit).toBe("sqft");
    expect(line.quantity).toBe(60);
    expect(line.meta.coverageSqft).toBe(60);
  });

  it("uses override coverage when supplied", () => {
    // Full body coverage instead of full front
    const line = priceLine(FULL_FRONT_PPF, { coverageSqft: 180 });
    expect(line.subtotalCents).toBe(centsFromDollars(180 * 32));
  });

  it("throws if no coverage available", () => {
    const svc = { ...FULL_FRONT_PPF, defaultCoverageSqft: null };
    expect(() => priceLine(svc)).toThrow(/coverage/i);
  });
});

describe("priceLine — hourly", () => {
  it("uses default estimated hours", () => {
    const line = priceLine(CUSTOM_LABOR);
    // 4 hours × $125 = $500
    expect(line.totalCents).toBe(centsFromDollars(500));
    expect(line.unit).toBe("hour");
    expect(line.taxable).toBe(false); // service.taxable respected
  });

  it("uses override hours", () => {
    const line = priceLine(CUSTOM_LABOR, { hours: 8.5 });
    expect(line.totalCents).toBe(centsFromDollars(8.5 * 125));
  });

  it("throws if no hourlyRateCents configured", () => {
    const svc = { ...CUSTOM_LABOR, hourlyRateCents: null };
    expect(() => priceLine(svc, { hours: 4 })).toThrow(/hourlyRateCents/i);
  });
});

describe("priceLine — matrix", () => {
  it("returns matrix price for matched vehicle size", () => {
    const line = priceLine(FULL_COLOR_CHANGE_WRAP, { vehicleSize: "suv" });
    expect(line.totalCents).toBe(centsFromDollars(4200));
    expect(line.meta.matrixResolved).toBe(true);
  });

  it("falls back to base priceCents for unmatched sizes", () => {
    const line = priceLine(FULL_COLOR_CHANGE_WRAP, { vehicleSize: "van" });
    expect(line.totalCents).toBe(centsFromDollars(3500));
    expect(line.meta.matrixResolved).toBe(false);
  });

  it("still respects quantity", () => {
    const line = priceLine(FULL_COLOR_CHANGE_WRAP, {
      vehicleSize: "exotic",
      quantity: 2,
    });
    expect(line.totalCents).toBe(centsFromDollars(6500 * 2));
  });
});

describe("priceLine — validation", () => {
  it("rejects quantity <= 0", () => {
    expect(() => priceLine(CERAMIC_L2, { quantity: 0 })).toThrow(/quantity/i);
  });

  it("rejects negative discountPercent", () => {
    expect(() => priceLine(CERAMIC_L2, { discountPercent: -5 })).toThrow();
  });

  it("rejects discountPercent > 100", () => {
    expect(() => priceLine(CERAMIC_L2, { discountPercent: 200 })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// computeQuoteTotals
// ---------------------------------------------------------------------------

describe("computeQuoteTotals", () => {
  const wrapLine = priceLine(FULL_COLOR_CHANGE_WRAP, { vehicleSize: "coupe" });
  const ppfLine = priceLine(FULL_FRONT_PPF);
  const ceramicLine = priceLine(CERAMIC_L2);
  // Non-taxable labor to verify partial-tax math.
  const laborLine = priceLine(CUSTOM_LABOR, { hours: 2 });

  it("sums subtotal + no discounts + no tax", () => {
    const t = computeQuoteTotals({
      lines: [wrapLine, ppfLine, ceramicLine],
    });
    expect(t.subtotalCents).toBe(
      wrapLine.subtotalCents + ppfLine.subtotalCents + ceramicLine.subtotalCents,
    );
    expect(t.taxCents).toBe(0);
    expect(t.totalCents).toBe(t.subtotalCents);
  });

  it("applies order-level percent discount", () => {
    const t = computeQuoteTotals({
      lines: [ceramicLine], // $900
      orderDiscountPercent: 20,
    });
    expect(t.orderDiscountCents).toBe(centsFromDollars(180));
    expect(t.totalCents).toBe(centsFromDollars(720));
  });

  it("applies sales tax only to taxable lines after all discounts", () => {
    // ceramicLine $900 taxable + laborLine $250 non-taxable
    const t = computeQuoteTotals({
      lines: [ceramicLine, laborLine],
      taxRateBps: 875, // 8.75%
    });
    // Tax only on ceramic → $900 * 0.0875 = $78.75
    expect(t.taxCents).toBe(centsFromDollars(78.75));
    expect(t.totalCents).toBe(centsFromDollars(900 + 250 + 78.75));
  });

  it("applies deposit percent to total", () => {
    const t = computeQuoteTotals({
      lines: [ceramicLine, laborLine],
      taxRateBps: 875,
      depositPercent: 20,
    });
    // total $1228.75, 20% = $245.75
    expect(t.depositCents).toBe(centsFromDollars(245.75));
    expect(t.balanceCents).toBe(t.totalCents - t.depositCents);
  });

  it("fixed deposit wins over percent", () => {
    const t = computeQuoteTotals({
      lines: [ceramicLine],
      depositCents: centsFromDollars(500),
      depositPercent: 20, // would be $180 — should be ignored
    });
    expect(t.depositCents).toBe(centsFromDollars(500));
  });

  it("caps deposit at total (no negative balance)", () => {
    const t = computeQuoteTotals({
      lines: [ceramicLine],
      depositCents: centsFromDollars(2000), // way more than total
    });
    expect(t.depositCents).toBe(t.totalCents);
    expect(t.balanceCents).toBe(0);
  });
});
