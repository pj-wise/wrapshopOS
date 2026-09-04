"use client";

import { Package } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { MATERIAL_TYPES } from "../defaults";
import { useCalculatorStore } from "../store";
import type { MaterialType } from "../types";

/**
 * Material type selector + per-sqft rate + specialty-laminate + complex-vehicle
 * toggles. Rate defaults come from `defaults.ts` and update automatically when
 * the material changes; the shop can still override with a manual per-sqft
 * price for a one-off estimate.
 */
export function MaterialPicker() {
  const materialType = useCalculatorStore((s) => s.materialType);
  const pricePerSqFt = useCalculatorStore((s) => s.pricePerSqFt);
  const specialtyLaminate = useCalculatorStore((s) => s.specialtyLaminate);
  const complexVehicle = useCalculatorStore((s) => s.complexVehicle);
  const setMaterialType = useCalculatorStore((s) => s.setMaterialType);
  const setPricePerSqFt = useCalculatorStore((s) => s.setPricePerSqFt);
  const setSpecialtyLaminate = useCalculatorStore((s) => s.setSpecialtyLaminate);
  const setComplexVehicle = useCalculatorStore((s) => s.setComplexVehicle);

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Package className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Material</h3>
      </div>
      <Tabs
        value={materialType}
        onValueChange={(v) => setMaterialType(v as MaterialType)}
      >
        <TabsList className="grid w-full grid-cols-3">
          {MATERIAL_TYPES.map((mt) => (
            <TabsTrigger key={mt} value={mt}>
              {mt}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="mt-3">
        <Label htmlFor="calc-price">Price per sqft ($)</Label>
        <Input
          id="calc-price"
          type="number"
          inputMode="decimal"
          min={0}
          step={0.25}
          value={pricePerSqFt || ""}
          onChange={(e) => setPricePerSqFt(Number(e.target.value) || 0)}
        />
      </div>
      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="calc-laminate" className="text-sm font-medium">
              Specialty laminate
            </Label>
            <p className="text-xs text-muted-foreground">
              Adds $1.50/sqft (matte, satin, ceramic-topcoat).
            </p>
          </div>
          <input
            id="calc-laminate"
            type="checkbox"
            className="h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full bg-neutral-200 transition-colors checked:bg-neutral-900 dark:bg-neutral-800 dark:checked:bg-neutral-100"
            checked={specialtyLaminate}
            onChange={(e) => setSpecialtyLaminate(e.target.checked)}
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="calc-complex" className="text-sm font-medium">
              Complex vehicle
            </Label>
            <p className="text-xs text-muted-foreground">
              Coupe / exotic / camo — adds 20% material + 30% labor.
            </p>
          </div>
          <input
            id="calc-complex"
            type="checkbox"
            className="h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full bg-neutral-200 transition-colors checked:bg-neutral-900 dark:bg-neutral-800 dark:checked:bg-neutral-100"
            checked={complexVehicle}
            onChange={(e) => setComplexVehicle(e.target.checked)}
          />
        </div>
      </div>
    </div>
  );
}
