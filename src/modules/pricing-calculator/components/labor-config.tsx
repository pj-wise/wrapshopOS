"use client";

import { Clock } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useCalculatorStore } from "../store";
import type { LaborPricingMode } from "../types";

/**
 * Labor pricing — hourly OR per-day. Overhead + waste % also live here since
 * they're the "how you charge for time / risk" section.
 */
export function LaborConfig() {
  const estimatedHours = useCalculatorStore((s) => s.estimatedHours);
  const hourlyRate = useCalculatorStore((s) => s.hourlyRate);
  const laborPricingMode = useCalculatorStore((s) => s.laborPricingMode);
  const laborCostPerDay = useCalculatorStore((s) => s.laborCostPerDay);
  const overheadPercentage = useCalculatorStore((s) => s.overheadPercentage);
  const wasteFactor = useCalculatorStore((s) => s.wasteFactor);

  const setEstimatedHours = useCalculatorStore((s) => s.setEstimatedHours);
  const setHourlyRate = useCalculatorStore((s) => s.setHourlyRate);
  const setLaborPricingMode = useCalculatorStore((s) => s.setLaborPricingMode);
  const setLaborCostPerDay = useCalculatorStore((s) => s.setLaborCostPerDay);
  const setOverheadPercentage = useCalculatorStore((s) => s.setOverheadPercentage);
  const setWasteFactor = useCalculatorStore((s) => s.setWasteFactor);

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Labor + overhead</h3>
      </div>
      <Tabs
        value={laborPricingMode}
        onValueChange={(v) => setLaborPricingMode(v as LaborPricingMode)}
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="hourly">Hourly</TabsTrigger>
          <TabsTrigger value="perDay">Per day</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="calc-hours">Estimated hours</Label>
          <Input
            id="calc-hours"
            type="number"
            inputMode="decimal"
            min={0}
            step={0.5}
            value={estimatedHours || ""}
            onChange={(e) => setEstimatedHours(Number(e.target.value) || 0)}
          />
        </div>
        {laborPricingMode === "hourly" ? (
          <div>
            <Label htmlFor="calc-hourly-rate">Hourly rate ($)</Label>
            <Input
              id="calc-hourly-rate"
              type="number"
              inputMode="decimal"
              min={0}
              step={5}
              value={hourlyRate || ""}
              onChange={(e) => setHourlyRate(Number(e.target.value) || 0)}
            />
          </div>
        ) : (
          <div>
            <Label htmlFor="calc-per-day">Cost per day ($)</Label>
            <Input
              id="calc-per-day"
              type="number"
              inputMode="decimal"
              min={0}
              step={25}
              value={laborCostPerDay || ""}
              onChange={(e) => setLaborCostPerDay(Number(e.target.value) || 0)}
            />
          </div>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="calc-overhead">Overhead (%)</Label>
          <Input
            id="calc-overhead"
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step={1}
            value={Math.round(overheadPercentage * 100)}
            onChange={(e) =>
              setOverheadPercentage((Number(e.target.value) || 0) / 100)
            }
          />
        </div>
        <div>
          <Label htmlFor="calc-waste">Waste (%)</Label>
          <Input
            id="calc-waste"
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step={1}
            value={Math.round(wasteFactor * 100)}
            onChange={(e) =>
              setWasteFactor((Number(e.target.value) || 0) / 100)
            }
          />
        </div>
      </div>
    </div>
  );
}
