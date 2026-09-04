import { describe, expect, it } from "vitest";

import { calculateEstimatedHours, calculateQuote } from "./calc";
import type { CalculatorState } from "./types";

function baseState(overrides: Partial<CalculatorState> = {}): CalculatorState {
  return {
    vehicle: { year: 2024, make: "Tesla", model: "Model 3", totalSquareFootage: 200 },
    materialType: "Vinyl Wrap",
    pricePerSqFt: 5.5,
    specialtyLaminate: false,
    complexVehicle: false,
    complexSurchargePercent: 0.2,
    estimatedHours: 16,
    hourlyRate: 75,
    laborPricingMode: "hourly",
    laborCostPerDay: 600,
    overheadPercentage: 0.15,
    wasteFactor: 0.15,
    marginMultiplier: 1.4,
    ...overrides,
  };
}

describe("calculateEstimatedHours", () => {
  it("Vinyl Wrap: 200 sqft × 0.08 = 16 hours (simple vehicle)", () => {
    expect(calculateEstimatedHours(200, "Vinyl Wrap", false)).toBeCloseTo(16, 5);
  });

  it("PPF: 200 sqft × 0.12 = 24 hours (simple vehicle)", () => {
    expect(calculateEstimatedHours(200, "PPF", false)).toBeCloseTo(24, 5);
  });

  it("Custom Print: 200 sqft × 0.10 = 20 hours (simple vehicle)", () => {
    expect(calculateEstimatedHours(200, "Custom Print", false)).toBeCloseTo(20, 5);
  });

  it("complex vehicle adds 30%: Vinyl 200 sqft → 20.8 hours", () => {
    expect(calculateEstimatedHours(200, "Vinyl Wrap", true)).toBeCloseTo(20.8, 5);
  });

  it("PPF complex vehicle 200 sqft → 31.2 hours", () => {
    expect(calculateEstimatedHours(200, "PPF", true)).toBeCloseTo(31.2, 5);
  });

  it("zero square footage returns zero hours", () => {
    expect(calculateEstimatedHours(0, "PPF", false)).toBe(0);
    expect(calculateEstimatedHours(0, "PPF", true)).toBe(0);
  });
});

describe("calculateQuote", () => {
  it("Vinyl Wrap 200 sqft baseline: material = 200 × 5.5 = $1100", () => {
    const r = calculateQuote(baseState());
    expect(r.materialCost).toBeCloseTo(1100, 5);
  });

  it("adds specialty laminate at $1.50/sqft", () => {
    const r = calculateQuote(baseState({ specialtyLaminate: true }));
    // (200 × 5.5) + (200 × 1.5) = 1100 + 300 = 1400
    expect(r.materialCost).toBeCloseTo(1400, 5);
  });

  it("applies complex-vehicle surcharge (default 20%) to material", () => {
    const r = calculateQuote(baseState({ complexVehicle: true }));
    // (200 × 5.5) × 1.2 = 1320
    expect(r.materialCost).toBeCloseTo(1320, 5);
  });

  it("respects custom complexSurchargePercent", () => {
    const r = calculateQuote(
      baseState({ complexVehicle: true, complexSurchargePercent: 0.35 }),
    );
    // (200 × 5.5) × 1.35 = 1485
    expect(r.materialCost).toBeCloseTo(1485, 5);
  });

  it("applies waste factor on top of material cost", () => {
    const r = calculateQuote(baseState());
    // 1100 × 1.15 = 1265
    expect(r.materialWithWaste).toBeCloseTo(1265, 5);
  });

  it("labor hourly mode = estimatedHours × hourlyRate", () => {
    const r = calculateQuote(baseState({ estimatedHours: 16, hourlyRate: 75 }));
    expect(r.laborCost).toBeCloseTo(1200, 5);
  });

  it("labor perDay mode = ceil(hours / 8) × laborCostPerDay", () => {
    const r = calculateQuote(
      baseState({
        laborPricingMode: "perDay",
        estimatedHours: 20, // ceil(20 / 8) = 3 days
        laborCostPerDay: 600,
      }),
    );
    expect(r.completionDays).toBe(3);
    expect(r.laborCost).toBeCloseTo(1800, 5);
  });

  it("overhead = (materialWithWaste + laborCost) × overheadPct", () => {
    const r = calculateQuote(baseState());
    // (1265 + 1200) × 0.15 = 369.75
    expect(r.overhead).toBeCloseTo(369.75, 5);
  });

  it("totalCost = materialWithWaste + laborCost + overhead", () => {
    const r = calculateQuote(baseState());
    // 1265 + 1200 + 369.75 = 2834.75
    expect(r.totalCost).toBeCloseTo(2834.75, 5);
  });

  it("suggestedPrice = totalCost × marginMultiplier", () => {
    const r = calculateQuote(baseState());
    // 2834.75 × 1.4 = 3968.65
    expect(r.suggestedPrice).toBeCloseTo(3968.65, 5);
  });

  it("profit = suggestedPrice - totalCost", () => {
    const r = calculateQuote(baseState());
    expect(r.profit).toBeCloseTo(r.suggestedPrice - r.totalCost, 5);
  });

  it("profitMargin as pct of suggestedPrice", () => {
    const r = calculateQuote(baseState());
    // 40% margin at 1.4x — (1.4x - x) / 1.4x = 0.2857...
    expect(r.profitMargin).toBeCloseTo((r.profit / r.suggestedPrice) * 100, 5);
    expect(r.profitMargin).toBeGreaterThan(28);
    expect(r.profitMargin).toBeLessThan(29);
  });

  it("zero sqft returns zeros without dividing by zero", () => {
    const r = calculateQuote(
      baseState({
        vehicle: { year: 0, make: "", model: "", totalSquareFootage: 0 },
        estimatedHours: 0,
      }),
    );
    expect(r.materialCost).toBe(0);
    expect(r.laborCost).toBe(0);
    expect(r.totalCost).toBe(0);
    expect(r.suggestedPrice).toBe(0);
    expect(r.profitMargin).toBe(0);
  });

  it("completionDays = ceil(estimatedHours / 8)", () => {
    expect(calculateQuote(baseState({ estimatedHours: 0 })).completionDays).toBe(0);
    expect(calculateQuote(baseState({ estimatedHours: 1 })).completionDays).toBe(1);
    expect(calculateQuote(baseState({ estimatedHours: 8 })).completionDays).toBe(1);
    expect(calculateQuote(baseState({ estimatedHours: 9 })).completionDays).toBe(2);
    expect(calculateQuote(baseState({ estimatedHours: 40 })).completionDays).toBe(5);
  });

  it("PPF full quote: 200 sqft, complex, laminate, hourly", () => {
    const r = calculateQuote(
      baseState({
        materialType: "PPF",
        pricePerSqFt: 8,
        specialtyLaminate: true,
        complexVehicle: true,
        estimatedHours: 31.2, // 200 × 0.12 × 1.3
      }),
    );
    // Material: ((200 × 8) + (200 × 1.5)) × 1.2 = 1900 × 1.2 = 2280
    expect(r.materialCost).toBeCloseTo(2280, 5);
    // Waste: 2280 × 1.15 = 2622
    expect(r.materialWithWaste).toBeCloseTo(2622, 5);
    // Labor: 31.2 × 75 = 2340
    expect(r.laborCost).toBeCloseTo(2340, 5);
    // Overhead: (2622 + 2340) × 0.15 = 744.3
    expect(r.overhead).toBeCloseTo(744.3, 5);
    // Total: 2622 + 2340 + 744.3 = 5706.3
    expect(r.totalCost).toBeCloseTo(5706.3, 5);
    // Suggested: 5706.3 × 1.4 = 7988.82
    expect(r.suggestedPrice).toBeCloseTo(7988.82, 5);
  });
});
