"use client";

import { useMemo } from "react";
import { Car } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { YEAR_MAX, YEAR_MIN } from "../defaults";
import { useCalculatorStore } from "../store";
import { getModelsForMake, getSquareFootage, makes } from "../vehicles";

const NONE = "__none__";

/**
 * Cascading year / make / model dropdowns. Selecting a make + model auto-fills
 * total square footage from the static size-category lookup; the shop can
 * still override sqft manually.
 *
 * Fully client-side. No API calls. Fine on Free tier.
 */
export function VehicleSelector() {
  const year = useCalculatorStore((s) => s.year);
  const make = useCalculatorStore((s) => s.make);
  const model = useCalculatorStore((s) => s.model);
  const totalSquareFootage = useCalculatorStore((s) => s.totalSquareFootage);
  const setYear = useCalculatorStore((s) => s.setYear);
  const setMake = useCalculatorStore((s) => s.setMake);
  const setModel = useCalculatorStore((s) => s.setModel);
  const setSquareFootage = useCalculatorStore((s) => s.setSquareFootage);

  const yearOptions = useMemo(() => {
    const out: number[] = [];
    for (let y = YEAR_MAX; y >= YEAR_MIN; y--) out.push(y);
    return out;
  }, []);

  const models = useMemo(() => (make ? getModelsForMake(make) : []), [make]);

  function onMakeChange(next: string | null) {
    const value = !next || next === NONE ? "" : next;
    setMake(value);
    // Clearing make also clears sqft (unless user manually set it).
    if (!value) setSquareFootage(0);
  }

  function onModelChange(next: string | null) {
    const value = !next || next === NONE ? "" : next;
    setModel(value);
    if (make && value) {
      const sqft = getSquareFootage(make, value);
      setSquareFootage(sqft);
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Car className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Vehicle</h3>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Optional — Free
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="calc-year">Year</Label>
          <Select
            value={year > 0 ? String(year) : NONE}
            onValueChange={(v) => setYear(!v || v === NONE ? 0 : Number(v))}
          >
            <SelectTrigger id="calc-year">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>—</SelectItem>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="calc-make">Make</Label>
          <Select value={make || NONE} onValueChange={onMakeChange}>
            <SelectTrigger id="calc-make">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>—</SelectItem>
              {makes.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="calc-model">Model</Label>
          <Select
            value={model || NONE}
            onValueChange={onModelChange}
            disabled={!make}
          >
            <SelectTrigger id="calc-model">
              <SelectValue placeholder={make ? "Pick model" : "Pick a make first"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>—</SelectItem>
              {models.map((m) => (
                <SelectItem key={m.name} value={m.name}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="mt-3">
        <Label htmlFor="calc-sqft">Total square footage</Label>
        <Input
          id="calc-sqft"
          type="number"
          inputMode="numeric"
          min={0}
          step={5}
          value={totalSquareFootage || ""}
          onChange={(e) => setSquareFootage(Number(e.target.value) || 0)}
          placeholder="Auto-fills from vehicle, or enter manually"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Vehicle selection is optional. Manually entering sqft works too.
        </p>
      </div>
    </div>
  );
}
