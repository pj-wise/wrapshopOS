"use client";

import { create } from "zustand";

import { calculateEstimatedHours, calculateQuote } from "./calc";
import {
  DEFAULT_COMPLEX_SURCHARGE_PERCENT,
  DEFAULT_HOURLY_RATE,
  DEFAULT_LABOR_COST_PER_DAY,
  DEFAULT_MARGIN_MULTIPLIER,
  DEFAULT_MATERIAL_PRICES,
  DEFAULT_OVERHEAD_PERCENTAGE,
  DEFAULT_WASTE_FACTOR,
} from "./defaults";
import type {
  CalculationResult,
  LaborPricingMode,
  MaterialType,
} from "./types";

/**
 * Client-side calculator state. Ported from ntense-pricing-calc/stores/calculatorStore.ts
 * with the AsyncStorage `saveCurrentQuote` path removed — persistence is now a
 * caller concern (public surface = nothing, in-app surface = tRPC mutation).
 *
 * Every setter that changes something the math depends on calls recalculate()
 * so `result` is always fresh — components can read it directly.
 */

export interface CalculatorStore {
  // Vehicle
  year: number;
  make: string;
  model: string;
  totalSquareFootage: number;

  // Material
  materialType: MaterialType;
  pricePerSqFt: number;
  specialtyLaminate: boolean;
  complexVehicle: boolean;
  complexSurchargePercent: number;

  // Labor
  estimatedHours: number;
  hourlyRate: number;
  laborPricingMode: LaborPricingMode;
  laborCostPerDay: number;

  // Business
  overheadPercentage: number;
  wasteFactor: number;
  marginMultiplier: number;

  // Output
  result: CalculationResult | null;

  // Setters
  setYear: (year: number) => void;
  setMake: (make: string) => void;
  setModel: (model: string) => void;
  setSquareFootage: (sqft: number) => void;
  setMaterialType: (type: MaterialType) => void;
  setPricePerSqFt: (price: number) => void;
  setSpecialtyLaminate: (value: boolean) => void;
  setComplexVehicle: (value: boolean) => void;
  setEstimatedHours: (hours: number) => void;
  setHourlyRate: (rate: number) => void;
  setLaborPricingMode: (mode: LaborPricingMode) => void;
  setLaborCostPerDay: (cost: number) => void;
  setOverheadPercentage: (pct: number) => void;
  setWasteFactor: (factor: number) => void;
  setMarginMultiplier: (multiplier: number) => void;

  recalculate: () => void;
  recalculateHours: () => void;
  reset: () => void;
}

export const useCalculatorStore = create<CalculatorStore>((set, get) => ({
  year: 0,
  make: "",
  model: "",
  totalSquareFootage: 0,
  materialType: "Vinyl Wrap",
  pricePerSqFt: DEFAULT_MATERIAL_PRICES["Vinyl Wrap"],
  specialtyLaminate: false,
  complexVehicle: false,
  complexSurchargePercent: DEFAULT_COMPLEX_SURCHARGE_PERCENT,
  estimatedHours: 0,
  hourlyRate: DEFAULT_HOURLY_RATE,
  laborPricingMode: "hourly",
  laborCostPerDay: DEFAULT_LABOR_COST_PER_DAY,
  overheadPercentage: DEFAULT_OVERHEAD_PERCENTAGE,
  wasteFactor: DEFAULT_WASTE_FACTOR,
  marginMultiplier: DEFAULT_MARGIN_MULTIPLIER,
  result: null,

  setYear: (year) => set({ year }),

  setMake: (make) => set({ make, model: "" }),

  setModel: (model) => set({ model }),

  setSquareFootage: (sqft) => {
    set({ totalSquareFootage: sqft });
    get().recalculateHours();
    get().recalculate();
  },

  setMaterialType: (type) => {
    set({
      materialType: type,
      pricePerSqFt: DEFAULT_MATERIAL_PRICES[type],
    });
    get().recalculateHours();
    get().recalculate();
  },

  setPricePerSqFt: (price) => {
    set({ pricePerSqFt: price });
    get().recalculate();
  },

  setSpecialtyLaminate: (value) => {
    set({ specialtyLaminate: value });
    get().recalculate();
  },

  setComplexVehicle: (value) => {
    set({ complexVehicle: value });
    get().recalculateHours();
    get().recalculate();
  },

  setEstimatedHours: (hours) => {
    set({ estimatedHours: hours });
    get().recalculate();
  },

  setHourlyRate: (rate) => {
    set({ hourlyRate: rate });
    get().recalculate();
  },

  setLaborPricingMode: (mode) => {
    set({ laborPricingMode: mode });
    get().recalculate();
  },

  setLaborCostPerDay: (cost) => {
    set({ laborCostPerDay: cost });
    get().recalculate();
  },

  setOverheadPercentage: (pct) => {
    set({ overheadPercentage: pct });
    get().recalculate();
  },

  setWasteFactor: (factor) => {
    set({ wasteFactor: factor });
    get().recalculate();
  },

  setMarginMultiplier: (multiplier) => {
    set({ marginMultiplier: multiplier });
    get().recalculate();
  },

  recalculateHours: () => {
    const { totalSquareFootage, materialType, complexVehicle } = get();
    const hours = calculateEstimatedHours(
      totalSquareFootage,
      materialType,
      complexVehicle,
    );
    set({ estimatedHours: Math.round(hours * 10) / 10 });
  },

  recalculate: () => {
    const state = get();
    const result = calculateQuote({
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
      complexSurchargePercent: state.complexSurchargePercent,
      estimatedHours: state.estimatedHours,
      hourlyRate: state.hourlyRate,
      laborPricingMode: state.laborPricingMode,
      laborCostPerDay: state.laborCostPerDay,
      overheadPercentage: state.overheadPercentage,
      wasteFactor: state.wasteFactor,
      marginMultiplier: state.marginMultiplier,
    });
    set({ result });
  },

  reset: () => {
    set({
      year: 0,
      make: "",
      model: "",
      totalSquareFootage: 0,
      materialType: "Vinyl Wrap",
      pricePerSqFt: DEFAULT_MATERIAL_PRICES["Vinyl Wrap"],
      specialtyLaminate: false,
      complexVehicle: false,
      complexSurchargePercent: DEFAULT_COMPLEX_SURCHARGE_PERCENT,
      estimatedHours: 0,
      hourlyRate: DEFAULT_HOURLY_RATE,
      laborPricingMode: "hourly",
      laborCostPerDay: DEFAULT_LABOR_COST_PER_DAY,
      overheadPercentage: DEFAULT_OVERHEAD_PERCENTAGE,
      wasteFactor: DEFAULT_WASTE_FACTOR,
      marginMultiplier: DEFAULT_MARGIN_MULTIPLIER,
      result: null,
    });
  },
}));
