import { z } from "zod";

const optionalTrimmed = z
  .string()
  .trim()
  .transform((v) => (v.length === 0 ? undefined : v))
  .optional();

// -------- Service categories --------

export const createServiceCategoryInput = z.object({
  key: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(80),
  sortOrder: z.number().int().min(0).max(999).default(0),
});
export const updateServiceCategoryInput = createServiceCategoryInput.partial().extend({
  id: z.string().uuid(),
});

// -------- Services --------

const pricingModel = z.enum(["flat", "coverage", "hourly", "matrix", "variable"]);

/**
 * Variable-pricing shape stored inside `matrixJson`. The `variableType`
 * discriminates a small set of built-in variable groups (Vehicle Size,
 * Longevity) plus a "custom" catch-all. Options are user-editable at both
 * label + price level.
 */
export const variableOption = z.object({
  key: z.string().trim().min(1).max(40),
  label: z.string().trim().min(1).max(80),
  priceCents: z.number().int().min(0),
  description: z.string().trim().max(500).optional(),
});
export const variablePricing = z.object({
  variableType: z.enum(["vehicle_size", "longevity", "custom"]),
  variableLabel: z.string().trim().min(1).max(60),
  /** When true, per-option `description` fields are shown / captured. */
  showOptionDescriptions: z.boolean().optional(),
  options: z.array(variableOption).min(1),
});

export const createServiceInput = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  sku: optionalTrimmed,
  name: z.string().trim().min(1).max(200),
  description: optionalTrimmed,
  active: z.boolean().default(true),
  pricingModel: pricingModel.default("flat"),
  priceCents: z.number().int().min(0).default(0),
  laborCostCents: z.number().int().min(0).nullable().optional(),
  productOnly: z.boolean().default(false),
  hourlyRateCents: z.number().int().min(0).nullable().optional(),
  estimatedHours: z.number().min(0).nullable().optional(),
  defaultCoverageSqft: z.number().min(0).nullable().optional(),
  // Loosened from `Record<string, number>` — variable pricing stores an
  // object under matrixJson. The pricing engine narrows at read time.
  matrixJson: z.record(z.string(), z.unknown()).default({}),
  defaultLaborHours: z.number().min(0).nullable().optional(),
  defaultMaterialSqft: z.number().min(0).nullable().optional(),
  defaultDurationDays: z.number().int().min(0).nullable().optional(),
  taxable: z.boolean().default(true),
  depositPercent: z.number().int().min(0).max(100).default(0),
  aftercareTemplate: optionalTrimmed,
});

export type VariableOption = z.infer<typeof variableOption>;
export type VariablePricing = z.infer<typeof variablePricing>;
export const updateServiceInput = createServiceInput.partial().extend({
  id: z.string().uuid(),
});

// -------- Materials --------

const materialCategory = z.enum([
  "vinyl",
  "clear_ppf",
  "colored_ppf",
  "matte_ppf",
  "tint",
  "ceramic",
  "laminate",
  "print_media",
  "other",
]);

export const createMaterialInput = z.object({
  vendorId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(200),
  sku: optionalTrimmed,
  category: materialCategory,
  manufacturer: optionalTrimmed,
  series: optionalTrimmed,
  film: optionalTrimmed,
  color: optionalTrimmed,
  finish: optionalTrimmed,
  widthIn: z.number().min(0).nullable().optional(),
  costPerFootCents: z.number().int().min(0).nullable().optional(),
  active: z.boolean().default(true),
  notes: optionalTrimmed,
});
export const updateMaterialInput = createMaterialInput.partial().extend({
  id: z.string().uuid(),
});

export const createMaterialRollInput = z.object({
  materialId: z.string().uuid(),
  vendorId: z.string().uuid().nullable().optional(),
  rollNumber: optionalTrimmed,
  lotNumber: optionalTrimmed,
  widthIn: z.number().min(0),
  startingLengthYd: z.number().min(0),
  remainingLengthYd: z.number().min(0),
  costCents: z.number().int().min(0),
  receivedAt: z.coerce.date().optional(),
  location: optionalTrimmed,
});
export const updateMaterialRollInput = createMaterialRollInput.partial().extend({
  id: z.string().uuid(),
});

// -------- Vendors --------

export const createVendorInput = z.object({
  name: z.string().trim().min(1).max(200),
  contactName: optionalTrimmed,
  contactEmail: z.string().trim().email().optional().or(z.literal("").transform(() => undefined)),
  contactPhone: optionalTrimmed,
  website: optionalTrimmed,
  notes: optionalTrimmed,
});
export const updateVendorInput = createVendorInput.partial().extend({
  id: z.string().uuid(),
});
