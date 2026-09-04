/**
 * Pricing-calculator domain types. Ported from ntense-pricing-calc/types/index.ts
 * with autoLuxOS-specific additions kept in this file rather than mutating the
 * upstream shape — makes future syncs mechanical.
 *
 * The math in `calc.ts` is a direct port; these types are its contract.
 */

export type MaterialType = "PPF" | "Vinyl Wrap" | "Custom Print";

export interface Vehicle {
  year: number;
  make: string;
  model: string;
  totalSquareFootage: number;
}

export interface VehicleData {
  make: string;
  models: VehicleModel[];
}

export interface VehicleModel {
  name: string;
  sizeCategory: SizeCategory;
}

export type SizeCategory =
  | "sedan-small"
  | "sedan-mid"
  | "sedan-large"
  | "coupe"
  | "sports-car"
  | "compact-suv"
  | "mid-suv"
  | "full-suv"
  | "truck-single"
  | "truck-crew"
  | "truck-hd"
  | "van"
  | "exotic";

export interface SizeCategoryInfo {
  label: string;
  minSqFt: number;
  maxSqFt: number;
  midpoint: number;
}

export type LaborPricingMode = "hourly" | "perDay";

export interface CalculatorState {
  vehicle: Vehicle;
  materialType: MaterialType;
  pricePerSqFt: number;
  specialtyLaminate: boolean;
  complexVehicle: boolean;
  /** Complex-vehicle surcharge as decimal (e.g. 0.2 = 20%). */
  complexSurchargePercent: number;
  estimatedHours: number;
  hourlyRate: number;
  laborPricingMode: LaborPricingMode;
  laborCostPerDay: number;
  /** Overhead as decimal (0.15 = 15%). */
  overheadPercentage: number;
  /** Waste factor as decimal (0.15 = 15%). */
  wasteFactor: number;
  /** Final markup multiplier (1.4 = 40% margin over total cost). */
  marginMultiplier: number;
}

export interface CalculationResult {
  materialCost: number;
  materialWithWaste: number;
  laborCost: number;
  overhead: number;
  totalCost: number;
  suggestedPrice: number;
  profit: number;
  profitMargin: number;
  estimatedHours: number;
  completionDays: number;
}
