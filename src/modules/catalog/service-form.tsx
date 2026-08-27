"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { centsFromDollars, dollarsFromCents, formatMoney } from "@/lib/money";
import type { VariableOption } from "@/lib/schemas/catalog";

export type PricingModel = "flat" | "coverage" | "hourly" | "matrix" | "variable";

export type VariableType = "vehicle_size" | "longevity" | "custom";

export type ServiceFormState = {
  name: string;
  description: string;
  pricingModel: PricingModel;
  productOnly: boolean;
  /** Base (product/material) price in dollars, as a string for input UX. */
  priceDollars: string;
  laborDollars: string;
  hourlyRateDollars: string;
  defaultCoverageSqft: string;
  depositPercent: string;
  active: boolean;
  variableType: VariableType;
  variableLabel: string;
  showOptionDescriptions: boolean;
  options: VariableOption[];
};

/** Tabs shown in the "Pricing options" section. */
const PRICING_TABS: Array<{ key: PricingModel; label: string }> = [
  { key: "flat", label: "Flat" },
  { key: "coverage", label: "Per sqft" },
  { key: "variable", label: "Variable (options)" },
];
const PRICING_TAB_KEYS = new Set<PricingModel>(PRICING_TABS.map((t) => t.key));

/** Coerce a persisted pricing model into one of the three visible tabs. */
function toTabKey(model: PricingModel | string | undefined): PricingModel {
  const m = (model ?? "flat") as PricingModel;
  if (PRICING_TAB_KEYS.has(m)) return m;
  // Legacy matrix → treat as variable (same shape after form init).
  if (m === "matrix") return "variable";
  // Legacy hourly → flat (labor cost field can pick up the rate role).
  return "flat";
}

export const EMPTY_FORM: ServiceFormState = {
  name: "",
  description: "",
  pricingModel: "flat",
  productOnly: false,
  priceDollars: "",
  laborDollars: "",
  hourlyRateDollars: "",
  defaultCoverageSqft: "",
  depositPercent: "0",
  active: true,
  variableType: "vehicle_size",
  variableLabel: "Vehicle Size",
  showOptionDescriptions: false,
  options: defaultOptionsFor("vehicle_size"),
};

const VARIABLE_LABEL_BY_TYPE: Record<VariableType, string> = {
  vehicle_size: "Vehicle Size",
  longevity: "Longevity",
  custom: "Options",
};

/** Starter options per built-in variable type. */
export function defaultOptionsFor(type: VariableType): VariableOption[] {
  if (type === "vehicle_size") {
    return [
      { key: "coupe", label: "Coupe", priceCents: 0 },
      { key: "sedan", label: "Sedan", priceCents: 0 },
      { key: "suv", label: "SUV", priceCents: 0 },
      { key: "truck", label: "Pickup Truck", priceCents: 0 },
    ];
  }
  if (type === "longevity") {
    return [
      { key: "5yr", label: "5 year", priceCents: 0 },
      { key: "7yr", label: "7 year", priceCents: 0 },
      { key: "10yr", label: "10 year", priceCents: 0 },
      { key: "lifetime", label: "Lifetime", priceCents: 0 },
    ];
  }
  return [{ key: "opt_1", label: "Option 1", priceCents: 0 }];
}

/**
 * Shared body of the New / Edit service dialogs. Handles the pricing-model
 * conditional fields, the Product-Only toggle, the Labor cost field, and the
 * Variable-pricing editor. Emits state up to the parent via `onChange`.
 *
 * A live breakdown card at the bottom always shows what the customer will pay
 * for the current input — surfaces off-by-one issues (labor + product) before
 * the user saves.
 */
export function ServiceForm({
  value,
  onChange,
}: {
  value: ServiceFormState;
  onChange: (patch: Partial<ServiceFormState>) => void;
}) {
  const {
    name,
    description,
    pricingModel,
    productOnly,
    priceDollars,
    laborDollars,
    defaultCoverageSqft,
    depositPercent,
    active,
    variableType,
    variableLabel,
    showOptionDescriptions,
    options,
  } = value;

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="s-name">Name</Label>
        <Input
          id="s-name"
          required
          placeholder="Full Color Change Wrap"
          value={name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="s-desc">Description</Label>
        <Textarea
          id="s-desc"
          rows={2}
          placeholder="What&apos;s included, disassembly, coverage notes…"
          value={description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </div>

      <label className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
        <input
          type="checkbox"
          checked={productOnly}
          onChange={(e) => onChange({ productOnly: e.target.checked })}
        />
        <span className="font-medium">Product only</span>
        <span className="text-muted-foreground">
          — no labor component; customer pays just the product price.
        </span>
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <Label className="mb-1.5 block">Pricing options</Label>
          <Tabs
            value={toTabKey(pricingModel)}
            onValueChange={(v) => v && onChange({ pricingModel: v as PricingModel })}
          >
            <TabsList className="w-full">
              {PRICING_TABS.map((t) => (
                <TabsTrigger key={t.key} value={t.key} className="flex-1">
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <div className="sm:w-28">
          <Label htmlFor="s-deposit">Deposit %</Label>
          <Input
            id="s-deposit"
            type="number"
            min={0}
            max={100}
            value={depositPercent}
            onChange={(e) => onChange({ depositPercent: e.target.value })}
          />
        </div>
      </div>

      {pricingModel === "flat" && (
        <div>
          <Label htmlFor="s-price">Product price (USD)</Label>
          <Input
            id="s-price"
            type="number"
            step="0.01"
            required
            placeholder="3500"
            value={priceDollars}
            onChange={(e) => onChange({ priceDollars: e.target.value })}
          />
        </div>
      )}

      {pricingModel === "coverage" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="s-price">Price per sqft</Label>
            <Input
              id="s-price"
              type="number"
              step="0.01"
              required
              placeholder="32"
              value={priceDollars}
              onChange={(e) => onChange({ priceDollars: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="s-coverage">Default coverage (sqft)</Label>
            <Input
              id="s-coverage"
              type="number"
              step="0.1"
              placeholder="60"
              value={defaultCoverageSqft}
              onChange={(e) => onChange({ defaultCoverageSqft: e.target.value })}
            />
          </div>
        </div>
      )}

      {pricingModel === "variable" && (
        <VariableEditor
          type={variableType}
          label={variableLabel}
          options={options}
          showOptionDescriptions={showOptionDescriptions}
          onTypeChange={(t) => {
            // Switching type resets to that type's defaults for the label +
            // options. The user's custom options for the old type are dropped
            // — no big deal since this is a create-time / edit-time UI, not
            // a runtime toggle.
            onChange({
              variableType: t,
              variableLabel: VARIABLE_LABEL_BY_TYPE[t],
              options: defaultOptionsFor(t),
            });
          }}
          onLabelChange={(v) => onChange({ variableLabel: v })}
          onOptionsChange={(opts) => onChange({ options: opts })}
          onToggleDescriptions={(v) => onChange({ showOptionDescriptions: v })}
        />
      )}

      {!productOnly && (
        <div>
          <Label htmlFor="s-labor">Labor cost (USD, optional)</Label>
          <Input
            id="s-labor"
            type="number"
            step="0.01"
            placeholder="1500"
            value={laborDollars}
            onChange={(e) => onChange({ laborDollars: e.target.value })}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Added on top of the product price. The customer-facing quote total is
            product + labor.
          </p>
        </div>
      )}

      <BreakdownCard value={value} />

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => onChange({ active: e.target.checked })}
        />
        Active (available for new quotes)
      </label>
    </div>
  );
}

// ============================================================================
// Variable pricing editor
// ============================================================================

function VariableEditor({
  type,
  label,
  options,
  showOptionDescriptions,
  onTypeChange,
  onLabelChange,
  onOptionsChange,
  onToggleDescriptions,
}: {
  type: VariableType;
  label: string;
  options: VariableOption[];
  showOptionDescriptions: boolean;
  onTypeChange: (t: VariableType) => void;
  onLabelChange: (v: string) => void;
  onOptionsChange: (opts: VariableOption[]) => void;
  onToggleDescriptions: (v: boolean) => void;
}) {
  function updateOption(idx: number, patch: Partial<VariableOption>) {
    const next = options.map((o, i) => (i === idx ? { ...o, ...patch } : o));
    onOptionsChange(next);
  }
  function addOption() {
    const nextKey = `opt_${options.length + 1}`;
    onOptionsChange([
      ...options,
      { key: nextKey, label: `Option ${options.length + 1}`, priceCents: 0 },
    ]);
  }
  function removeOption(idx: number) {
    if (options.length <= 1) return; // always leave at least one
    onOptionsChange(options.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-3 rounded-md border bg-muted/20 p-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Variable type</Label>
          <Select value={type} onValueChange={(v) => v && onTypeChange(v as VariableType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="vehicle_size">Vehicle Size</SelectItem>
              <SelectItem value="longevity">Longevity</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="var-label">Label shown to shop</Label>
          <Input
            id="var-label"
            value={label}
            onChange={(e) => onLabelChange(e.target.value)}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={showOptionDescriptions}
          onChange={(e) => onToggleDescriptions(e.target.checked)}
        />
        <span>Include per-option descriptions</span>
        <span className="text-xs text-muted-foreground">
          (optional detail shown beneath each option name)
        </span>
      </label>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <Label className="text-xs">Options</Label>
          <Button type="button" size="sm" variant="ghost" onClick={addOption}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add option
          </Button>
        </div>
        <ul className="space-y-2">
          {options.map((o, i) => (
            <li key={i} className="space-y-1.5 rounded border bg-background p-2">
              <div className="flex items-center gap-2">
                <Input
                  value={o.label}
                  onChange={(e) =>
                    updateOption(i, {
                      label: e.target.value,
                      // Keep the key stable unless it clearly came from the default.
                      key: o.key || slugify(e.target.value) || `opt_${i + 1}`,
                    })
                  }
                  placeholder="Option name"
                  className="flex-1"
                />
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={o.priceCents ? dollarsFromCents(o.priceCents).toString() : ""}
                    onChange={(e) =>
                      updateOption(i, {
                        priceCents: e.target.value
                          ? centsFromDollars(Number(e.target.value))
                          : 0,
                      })
                    }
                    placeholder="0"
                    className="w-24 text-right tabular-nums"
                  />
                </div>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => removeOption(i)}
                  disabled={options.length <= 1}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Remove option"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              {showOptionDescriptions && (
                <Textarea
                  rows={2}
                  placeholder="Optional description (e.g. film type, panel count, warranty terms)…"
                  value={o.description ?? ""}
                  onChange={(e) =>
                    updateOption(i, {
                      description: e.target.value.length > 0 ? e.target.value : undefined,
                    })
                  }
                  className="text-xs"
                />
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ============================================================================
// Breakdown card — live preview of what the customer will pay.
// ============================================================================

function BreakdownCard({ value }: { value: ServiceFormState }) {
  const {
    pricingModel,
    productOnly,
    priceDollars,
    laborDollars,
    hourlyRateDollars,
    defaultCoverageSqft,
    options,
  } = value;

  const productCents = useMemo(() => {
    switch (pricingModel) {
      case "flat":
        return priceDollars ? centsFromDollars(Number(priceDollars)) : 0;
      case "coverage": {
        const perSqft = priceDollars ? centsFromDollars(Number(priceDollars)) : 0;
        const sqft = defaultCoverageSqft ? Number(defaultCoverageSqft) : 0;
        return Math.round(perSqft * sqft);
      }
      case "hourly": {
        return hourlyRateDollars ? centsFromDollars(Number(hourlyRateDollars)) : 0;
      }
      case "variable": {
        return options[0]?.priceCents ?? 0;
      }
      default:
        return 0;
    }
  }, [pricingModel, priceDollars, hourlyRateDollars, defaultCoverageSqft, options]);

  const laborCents = productOnly
    ? 0
    : laborDollars
      ? centsFromDollars(Number(laborDollars))
      : 0;
  const totalCents = productCents + laborCents;

  const productLabel = useMemo(() => {
    if (pricingModel === "coverage") {
      const per = priceDollars ? formatMoney(centsFromDollars(Number(priceDollars))) : "$0";
      const sqft = defaultCoverageSqft || "?";
      return `${per}/sqft × ${sqft} sqft`;
    }
    if (pricingModel === "hourly") return "hourly rate (per hour)";
    if (pricingModel === "variable") {
      return options.length > 0 ? `first option "${options[0].label}"` : "no options yet";
    }
    return "product / material";
  }, [pricingModel, priceDollars, defaultCoverageSqft, options]);

  return (
    <div className="rounded-md border bg-card p-3 text-sm">
      <div className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Breakdown preview
      </div>
      <dl className="space-y-1">
        <Row label={`Product (${productLabel})`} valueCents={productCents} />
        {!productOnly && <Row label="Labor" valueCents={laborCents} muted={laborCents === 0} />}
        <div className="mt-2 border-t pt-2">
          <Row label="Customer total" valueCents={totalCents} bold />
        </div>
        {pricingModel === "variable" && options.length > 1 && !productOnly && (
          <p className="mt-2 text-xs text-muted-foreground">
            Each variable option gets its own product price. Labor is added on top of
            whichever option the customer selects.
          </p>
        )}
      </dl>
    </div>
  );
}

function Row({
  label,
  valueCents,
  muted,
  bold,
}: {
  label: string;
  valueCents: number;
  muted?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className={cn("truncate", muted && "text-muted-foreground", bold && "font-medium")}>
        {label}
      </dt>
      <dd
        className={cn(
          "font-mono tabular-nums",
          muted && "text-muted-foreground",
          bold && "font-semibold",
        )}
      >
        {formatMoney(valueCents)}
      </dd>
    </div>
  );
}

function slugify(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

// ============================================================================
// Reading a persisted service back into form state.
// ============================================================================

export type PersistedService = {
  name: string;
  description: string | null;
  pricingModel: string;
  productOnly: boolean;
  priceCents: number;
  laborCostCents: number | null;
  hourlyRateCents: number | null;
  defaultCoverageSqft: unknown;
  depositPercent: number;
  active: boolean;
  matrixJson: unknown;
};

export function formStateFromService(svc: PersistedService): ServiceFormState {
  const parsed = parseVariableMatrix(svc.matrixJson);
  const persistedModel = (svc.pricingModel as PricingModel) ?? "flat";
  return {
    name: svc.name,
    description: svc.description ?? "",
    // Coerce legacy models (matrix/hourly) into a visible tab.
    pricingModel: toTabKey(persistedModel),
    productOnly: svc.productOnly,
    priceDollars: dollarsFromCents(svc.priceCents).toString(),
    laborDollars:
      svc.laborCostCents != null ? dollarsFromCents(svc.laborCostCents).toString() : "",
    hourlyRateDollars: svc.hourlyRateCents
      ? dollarsFromCents(svc.hourlyRateCents).toString()
      : "",
    defaultCoverageSqft: svc.defaultCoverageSqft ? String(svc.defaultCoverageSqft) : "",
    depositPercent: (svc.depositPercent ?? 0).toString(),
    active: svc.active,
    variableType: parsed?.variableType ?? "vehicle_size",
    variableLabel:
      parsed?.variableLabel ??
      VARIABLE_LABEL_BY_TYPE[parsed?.variableType ?? "vehicle_size"],
    showOptionDescriptions:
      parsed?.showOptionDescriptions ??
      (parsed?.options.some((o) => Boolean(o.description)) ?? false),
    options: parsed?.options ?? defaultOptionsFor("vehicle_size"),
  };
}

function parseVariableMatrix(raw: unknown): {
  variableType: VariableType;
  variableLabel: string;
  showOptionDescriptions?: boolean;
  options: VariableOption[];
} | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (
    typeof obj.variableType === "string" &&
    typeof obj.variableLabel === "string" &&
    Array.isArray(obj.options)
  ) {
    const opts = obj.options.flatMap<VariableOption>((o) => {
      if (!o || typeof o !== "object") return [];
      const rec = o as Record<string, unknown>;
      if (
        typeof rec.key === "string" &&
        typeof rec.label === "string" &&
        typeof rec.priceCents === "number"
      ) {
        return [
          {
            key: rec.key,
            label: rec.label,
            priceCents: rec.priceCents,
            description:
              typeof rec.description === "string" ? rec.description : undefined,
          },
        ];
      }
      return [];
    });
    if (opts.length === 0) return null;
    return {
      variableType: obj.variableType as VariableType,
      variableLabel: obj.variableLabel,
      showOptionDescriptions:
        typeof obj.showOptionDescriptions === "boolean"
          ? obj.showOptionDescriptions
          : undefined,
      options: opts,
    };
  }
  return null;
}

// ============================================================================
// Building the wire payload for services.create / services.update.
// ============================================================================

export function buildServicePayload(f: ServiceFormState) {
  const priceCents = f.priceDollars ? centsFromDollars(Number(f.priceDollars)) : 0;
  const laborCostCents = f.productOnly
    ? null
    : f.laborDollars
      ? centsFromDollars(Number(f.laborDollars))
      : null;

  const base = {
    name: f.name.trim(),
    description: f.description.trim() || undefined,
    pricingModel: f.pricingModel,
    productOnly: f.productOnly,
    priceCents,
    laborCostCents,
    depositPercent: Number(f.depositPercent) || 0,
    active: f.active,
    taxable: true,
  };

  if (f.pricingModel === "coverage") {
    return {
      ...base,
      defaultCoverageSqft: f.defaultCoverageSqft ? Number(f.defaultCoverageSqft) : undefined,
      matrixJson: {} as Record<string, unknown>,
    };
  }
  if (f.pricingModel === "hourly") {
    return {
      ...base,
      hourlyRateCents: f.hourlyRateDollars
        ? centsFromDollars(Number(f.hourlyRateDollars))
        : undefined,
      matrixJson: {} as Record<string, unknown>,
    };
  }
  if (f.pricingModel === "variable") {
    return {
      ...base,
      matrixJson: {
        variableType: f.variableType,
        variableLabel: f.variableLabel.trim() || VARIABLE_LABEL_BY_TYPE[f.variableType],
        showOptionDescriptions: f.showOptionDescriptions,
        options: f.options
          .filter((o) => o.label.trim().length > 0)
          .map((o, i) => ({
            key: o.key || slugify(o.label) || `opt_${i + 1}`,
            label: o.label.trim(),
            priceCents: o.priceCents,
            ...(f.showOptionDescriptions && o.description?.trim()
              ? { description: o.description.trim() }
              : {}),
          })),
      } as Record<string, unknown>,
    };
  }
  return { ...base, matrixJson: {} as Record<string, unknown> };
}

/**
 * Small hook helper to keep `useState<ServiceFormState>` + a patch-style
 * updater DRY inside the two dialog wrappers.
 */
export function useServiceFormState(initial: ServiceFormState) {
  const [state, setState] = useState<ServiceFormState>(initial);
  useEffect(() => {
    setState(initial);
  }, [initial]);
  const patch = (p: Partial<ServiceFormState>) => setState((s) => ({ ...s, ...p }));
  return [state, patch, setState] as const;
}
