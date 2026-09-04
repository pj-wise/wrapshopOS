"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, BarChart3, Save, TrendingUp } from "lucide-react";

import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/money";
import { FeatureGate } from "@/modules/shared/feature-gate";
import { useFeatureEnabled } from "@/hooks/use-features";

import { useCalculatorStore } from "../store";

import { PricingCalculator } from "./pricing-calculator";

const NONE = "__none__";

/**
 * In-app calculator surface: same calculator + Save-as-Quote button +
 * recent estimates + Shop-tier analytics widget.
 */
export function InAppPricingCalculator() {
  const [saveOpen, setSaveOpen] = useState(false);

  const result = useCalculatorStore((s) => s.result);
  const canSave = (result?.suggestedPrice ?? 0) > 0;

  return (
    <PricingCalculator
      actions={
        <div className="space-y-3">
          <Button
            type="button"
            className="w-full"
            disabled={!canSave}
            onClick={() => setSaveOpen(true)}
          >
            <Save className="mr-2 h-4 w-4" />
            Save as Draft Quote
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Creates a draft quote you can edit in the Quotes tab.
          </p>
          <SaveAsQuoteDialog open={saveOpen} onOpenChange={setSaveOpen} />
        </div>
      }
      secondary={
        <>
          <RecentEstimates />
          <CalculatorAnalytics />
        </>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Save-as-quote dialog
// ---------------------------------------------------------------------------

function SaveAsQuoteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState<string>("");
  const customersQ = trpc.customers.list.useQuery(
    { limit: 200 },
    { enabled: open },
  );
  const utils = trpc.useUtils();
  const save = trpc.pricingCalculator.saveAsQuote.useMutation();
  const state = useCalculatorStore();

  async function onSave() {
    if (!customerId || !state.result) return;
    try {
      const res = await save.mutateAsync({
        customerId,
        snapshot: {
          vehicle: {
            year: state.year,
            make: state.make,
            model: state.model,
            totalSquareFootage: state.totalSquareFootage,
          },
          materialType: state.materialType,
          pricePerSqFt: state.pricePerSqFt,
          specialtyLaminate: state.specialtyLaminate,
          complexVehicle: state.complexVehicle,
          estimatedHours: state.estimatedHours,
          hourlyRate: state.hourlyRate,
          laborPricingMode: state.laborPricingMode,
          laborCostPerDay: state.laborCostPerDay,
          overheadPercentage: state.overheadPercentage,
          wasteFactor: state.wasteFactor,
          marginMultiplier: state.marginMultiplier,
          suggestedPriceCents: Math.round(state.result.suggestedPrice * 100),
          totalCostCents: Math.round(state.result.totalCost * 100),
          profitCents: Math.round(state.result.profit * 100),
        },
      });
      toast.success(`Draft quote Q-${String(res.quoteNumber).padStart(4, "0")} saved.`);
      await utils.pricingCalculator.recentEstimates.invalidate();
      onOpenChange(false);
      router.push(`/quotes/${res.quoteId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  }

  const customers = customersQ.data?.items ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save as Draft Quote</DialogTitle>
          <DialogDescription>
            Attach this estimate to a customer. You&apos;ll be redirected to
            the full quote editor.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="save-customer">Customer</Label>
            {customersQ.isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : customers.length === 0 ? (
              <div className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
                No customers yet.{" "}
                <Link
                  href="/customers"
                  className="underline"
                  onClick={() => onOpenChange(false)}
                >
                  Add one
                </Link>
                , then come back.
              </div>
            ) : (
              <Select
                value={customerId || NONE}
                onValueChange={(v) => setCustomerId(!v || v === NONE ? "" : v)}
              >
                <SelectTrigger id="save-customer">
                  <SelectValue placeholder="Pick a customer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={!customerId || save.isPending}
          >
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Recent estimates panel
// ---------------------------------------------------------------------------

function RecentEstimates() {
  const q = trpc.pricingCalculator.recentEstimates.useQuery({ limit: 5 });

  if (q.isLoading) {
    return (
      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Recent estimates
        </h3>
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const items = q.data?.items ?? [];
  if (items.length === 0) return null;

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Recent estimates
      </h3>
      <ul className="divide-y text-sm">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/quotes/${item.id}`}
              className="flex items-center justify-between gap-3 py-2.5 hover:bg-accent/40"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-mono text-xs tabular-nums">
                  Q-{String(item.number).padStart(4, "0")}
                </div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">
                  {item.customer?.name ?? "—"}
                </div>
              </div>
              <div className="text-right text-sm tabular-nums">
                {formatMoney(item.totalCents)}
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-3 text-right">
        <Link
          href="/quotes"
          className="inline-flex items-center gap-1 text-xs text-neutral-900 hover:underline dark:text-neutral-100"
        >
          All quotes
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Analytics widget — Shop tier gated
// ---------------------------------------------------------------------------

function CalculatorAnalytics() {
  const enabled = useFeatureEnabled("reporting.basic_profitability");
  return (
    <FeatureGate feature="reporting.basic_profitability" fallback="tooltip">
      {enabled && <CalculatorAnalyticsInner />}
    </FeatureGate>
  );
}

function CalculatorAnalyticsInner() {
  const q = trpc.pricingCalculator.analytics.useQuery({ days: 30 });

  const byMaterialList = useMemo(() => {
    if (!q.data) return [];
    return Object.entries(q.data.byMaterial).map(([material, stats]) => ({
      material,
      ...stats,
    }));
  }, [q.data]);

  if (q.isLoading) {
    return (
      <div className="rounded-lg border bg-card p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          <BarChart3 className="h-3 w-3" />
          Calculator activity — last 30 days
        </div>
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (!q.data || q.data.count === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-card p-4">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          <BarChart3 className="h-3 w-3" />
          Calculator activity
        </div>
        <p className="text-sm text-muted-foreground">
          No calculator estimates saved yet in the last 30 days.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        <BarChart3 className="h-3 w-3" />
        Calculator activity — last 30 days
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-muted-foreground">Estimates saved</div>
          <div className="text-xl font-semibold tabular-nums">
            {q.data.count}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Total value</div>
          <div className="text-xl font-semibold tabular-nums">
            {formatMoney(q.data.totalValueCents)}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Avg estimate</div>
          <div className="text-xl font-semibold tabular-nums">
            {formatMoney(q.data.avgValueCents)}
          </div>
        </div>
        <div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <TrendingUp className="h-3 w-3" /> Top material
          </div>
          <div className="text-xl font-semibold">
            {byMaterialList.sort((a, b) => b.count - a.count)[0]?.material ?? "—"}
          </div>
        </div>
      </div>
      {byMaterialList.length > 0 && (
        <ul className="mt-3 divide-y text-xs">
          {byMaterialList.map((m) => (
            <li key={m.material} className="flex justify-between py-1.5">
              <span>
                {m.material}{" "}
                <span className="text-muted-foreground">× {m.count}</span>
              </span>
              <span className="tabular-nums">
                {formatMoney(m.totalCents)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
