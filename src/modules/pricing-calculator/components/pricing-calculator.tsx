"use client";

import { type ReactNode, useEffect } from "react";

import { useCalculatorStore } from "../store";

import { LaborConfig } from "./labor-config";
import { MarginSlider } from "./margin-slider";
import { MaterialPicker } from "./material-picker";
import { ResultsCard } from "./results-card";
import { VehicleSelector } from "./vehicle-selector";

/**
 * The full pricing calculator UI. Same component powers both the public
 * landing surface (`/calculator`) and the in-app surface
 * (`/pricing-calculator`). Callers control the action strip via `actions`
 * — that's where "Save as Draft Quote" (in-app) or "Sign up to save"
 * (public) lands.
 *
 * `secondary` optionally renders below the results card — great spot for
 * "My Estimates" history or a Solo-locked "Look up by VIN" prompt.
 */
export function PricingCalculator({
  actions,
  secondary,
}: {
  actions?: ReactNode;
  secondary?: ReactNode;
}) {
  // Compute an initial result on mount so the ResultsCard doesn't show its
  // empty state indefinitely for users who don't touch anything.
  const recalculate = useCalculatorStore((s) => s.recalculate);
  useEffect(() => {
    recalculate();
  }, [recalculate]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      {/* Left rail: inputs (2/3 on desktop) */}
      <div className="space-y-4 lg:col-span-3">
        <VehicleSelector />
        <MaterialPicker />
        <LaborConfig />
        <MarginSlider />
      </div>
      {/* Right rail: results + actions */}
      <div className="space-y-4 lg:col-span-2">
        <ResultsCard />
        {actions && (
          <div className="rounded-lg border bg-card p-4">{actions}</div>
        )}
        {secondary}
      </div>
    </div>
  );
}
