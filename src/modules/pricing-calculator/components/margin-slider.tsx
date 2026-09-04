"use client";

import { TrendingUp } from "lucide-react";

import { useCalculatorStore } from "../store";

/**
 * Final margin multiplier. 1.0 = at-cost (no markup). Default 1.4 = 40% markup.
 * Native range input styled to match the app.
 */
export function MarginSlider() {
  const marginMultiplier = useCalculatorStore((s) => s.marginMultiplier);
  const setMarginMultiplier = useCalculatorStore((s) => s.setMarginMultiplier);

  const markupPct = Math.round((marginMultiplier - 1) * 100);
  const impliedMargin = Math.round(((marginMultiplier - 1) / marginMultiplier) * 100);

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Markup</h3>
      </div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-muted-foreground">
          {marginMultiplier.toFixed(2)}× — <strong>{markupPct}%</strong> markup
        </span>
        <span className="text-xs text-muted-foreground">
          ≈ {impliedMargin}% profit margin
        </span>
      </div>
      <input
        type="range"
        min={1}
        max={3}
        step={0.05}
        value={marginMultiplier}
        onChange={(e) => setMarginMultiplier(Number(e.target.value))}
        className="mt-3 w-full accent-neutral-900 dark:accent-neutral-100"
      />
      <div className="mt-1 flex justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
        <span>1.0× (cost)</span>
        <span>2.0×</span>
        <span>3.0×</span>
      </div>
    </div>
  );
}
