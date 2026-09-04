import type { MaterialType } from "./types";

/**
 * Sensible defaults for the public calculator surface. In-app can override
 * per-org via Organization.settings.pricingCalculator (deferred to a follow-up).
 */

export const DEFAULT_MATERIAL_PRICES: Record<MaterialType, number> = {
  PPF: 22.0,
  "Vinyl Wrap": 7.0, // color change
  "Custom Print": 12.5,
};

export const DEFAULT_HOURLY_RATE = 75;
export const DEFAULT_LABOR_COST_PER_DAY = 600;
export const DEFAULT_OVERHEAD_PERCENTAGE = 0.15;
export const DEFAULT_WASTE_FACTOR = 0.15;
export const DEFAULT_MARGIN_MULTIPLIER = 1.4;
export const DEFAULT_COMPLEX_SURCHARGE_PERCENT = 0.2;

export const MATERIAL_TYPES = ["PPF", "Vinyl Wrap", "Custom Print"] as const;

/**
 * Year range for the vehicle year dropdown. Regenerated at module load;
 * for a "current year" that stays accurate, the caller (or a future
 * deploy-time constant) can override.
 */
export const YEAR_MIN = 2000;
export const YEAR_MAX = 2026;
