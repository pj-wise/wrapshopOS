"use client";

import { Receipt, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";

import { useCalculatorStore } from "../store";

/**
 * Line-item breakdown + the headline suggested-price + profit stats.
 * Reads the pre-computed `result` off the store; setters recalculate on change.
 */
export function ResultsCard() {
  const result = useCalculatorStore((s) => s.result);
  const estimatedHours = useCalculatorStore((s) => s.estimatedHours);

  if (!result || result.suggestedPrice === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center">
        <Receipt className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Enter square footage to see the estimate.
        </p>
      </div>
    );
  }

  const cents = (n: number) => Math.round(n * 100);

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Receipt className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Estimate</h3>
      </div>

      {/* Suggested price — the headline */}
      <div className="rounded-md bg-neutral-900 p-5 text-neutral-50 dark:bg-neutral-100 dark:text-neutral-900">
        <div className="text-xs font-medium uppercase tracking-widest opacity-70">
          Suggested price
        </div>
        <div className="mt-1 text-4xl font-semibold tabular-nums">
          {formatMoney(cents(result.suggestedPrice))}
        </div>
        <div className="mt-2 flex items-center gap-1 text-sm opacity-90">
          <TrendingUp className="h-3.5 w-3.5" />
          {formatMoney(cents(result.profit))} profit ·{" "}
          {result.profitMargin.toFixed(1)}% margin
        </div>
      </div>

      {/* Breakdown */}
      <dl className="mt-4 space-y-1.5 text-sm">
        <Row label="Material" value={formatMoney(cents(result.materialCost))} />
        <Row
          label="Material + waste"
          value={formatMoney(cents(result.materialWithWaste))}
          muted
        />
        <Row label="Labor" value={formatMoney(cents(result.laborCost))} />
        <Row label="Overhead" value={formatMoney(cents(result.overhead))} />
        <div className="my-2 h-px bg-border" />
        <Row
          label="Total cost"
          value={formatMoney(cents(result.totalCost))}
          bold
        />
      </dl>

      <div className="mt-4 flex justify-between text-xs text-muted-foreground">
        <span>
          {estimatedHours.toFixed(1)} hours · {result.completionDays}{" "}
          {result.completionDays === 1 ? "day" : "days"} to complete
        </span>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  muted,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex justify-between gap-4",
        bold && "font-medium",
        muted && "text-muted-foreground",
      )}
    >
      <dt className={muted ? "" : "text-muted-foreground"}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
