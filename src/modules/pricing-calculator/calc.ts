/**
 * Pure pricing math. Ported verbatim from ntense-pricing-calc/lib/calculator.ts
 * — no React, no I/O, no side effects. Fully unit-testable.
 */

import type { CalculationResult, CalculatorState, MaterialType } from "./types";

/** Labor-hours per square foot by material. */
const hoursPerSqFt: Record<MaterialType, number> = {
  PPF: 0.12,
  "Vinyl Wrap": 0.08,
  "Custom Print": 0.1,
};

export function calculateEstimatedHours(
  totalSqFt: number,
  materialType: MaterialType,
  complexVehicle: boolean,
): number {
  const baseHours = totalSqFt * hoursPerSqFt[materialType];
  return complexVehicle ? baseHours * 1.3 : baseHours;
}

export function calculateQuote(state: CalculatorState): CalculationResult {
  const {
    vehicle,
    pricePerSqFt,
    specialtyLaminate,
    complexVehicle,
    complexSurchargePercent,
    estimatedHours,
    hourlyRate,
    laborPricingMode,
    laborCostPerDay,
    overheadPercentage,
    wasteFactor,
    marginMultiplier,
  } = state;

  const totalSqFt = vehicle.totalSquareFootage;
  const completionDays = Math.ceil(estimatedHours / 8);

  // Material cost
  const baseMaterialCost = totalSqFt * pricePerSqFt;
  const laminateCost = specialtyLaminate ? totalSqFt * 1.5 : 0;
  const complexMultiplier = complexVehicle ? 1 + complexSurchargePercent : 1;
  const materialCost = (baseMaterialCost + laminateCost) * complexMultiplier;

  // Material with waste
  const materialWithWaste = materialCost * (1 + wasteFactor);

  // Labor: hourly (hours × rate) or per-day (days × cost per day)
  const laborCost =
    laborPricingMode === "perDay"
      ? completionDays * laborCostPerDay
      : estimatedHours * hourlyRate;

  // Totals
  const overhead = (materialWithWaste + laborCost) * overheadPercentage;
  const totalCost = materialWithWaste + laborCost + overhead;
  const suggestedPrice = totalCost * marginMultiplier;
  const profit = suggestedPrice - totalCost;
  const profitMargin = suggestedPrice > 0 ? (profit / suggestedPrice) * 100 : 0;

  return {
    materialCost,
    materialWithWaste,
    laborCost,
    overhead,
    totalCost,
    suggestedPrice,
    profit,
    profitMargin,
    estimatedHours,
    completionDays,
  };
}
