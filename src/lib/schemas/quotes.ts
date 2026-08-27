import { z } from "zod";

const optionalTrimmed = z
  .string()
  .trim()
  .transform((v) => (v.length === 0 ? undefined : v))
  .optional();

const lineUnit = z.enum(["each", "sqft", "linear_ft", "hour"]);

export const quoteLineInput = z.object({
  serviceId: z.string().uuid().nullable().optional(),
  materialId: z.string().uuid().nullable().optional(),
  description: z.string().trim().min(1).max(400),
  quantity: z.number().min(0).default(1),
  unit: lineUnit.default("each"),
  unitPriceCents: z.number().int().min(0).default(0),
  discountCents: z.number().int().min(0).default(0),
  taxable: z.boolean().default(true),
  isUpsell: z.boolean().default(false),
  notes: optionalTrimmed,
});

export const createQuoteInput = z.object({
  customerId: z.string().uuid(),
  vehicleId: z.string().uuid().nullable().optional(),
  currency: z.string().length(3).default("USD"),
  taxRateBps: z.number().int().min(0).max(3000).default(0),
  depositCents: z.number().int().min(0).default(0),
  depositPercent: z.number().int().min(0).max(100).default(0),
  terms: optionalTrimmed,
  customerNotes: optionalTrimmed,
  internalNotes: optionalTrimmed,
  expiresAt: z.coerce.date().nullable().optional(),
  items: z.array(quoteLineInput).default([]),
});

export const updateQuoteInput = z.object({
  id: z.string().uuid(),
  customerId: z.string().uuid().optional(),
  vehicleId: z.string().uuid().nullable().optional(),
  currency: z.string().length(3).optional(),
  taxRateBps: z.number().int().min(0).max(3000).optional(),
  depositCents: z.number().int().min(0).optional(),
  depositPercent: z.number().int().min(0).max(100).optional(),
  terms: optionalTrimmed,
  customerNotes: optionalTrimmed,
  internalNotes: optionalTrimmed,
  expiresAt: z.coerce.date().nullable().optional(),
  items: z.array(quoteLineInput.extend({ id: z.string().uuid().optional() })).optional(),
});

export const priceLinePreviewInput = z.object({
  serviceId: z.string().uuid(),
  vehicleId: z.string().uuid().optional(),
  quantity: z.number().min(0).optional(),
  coverageSqft: z.number().min(0).optional(),
  hours: z.number().min(0).optional(),
  vehicleSize: z
    .enum(["compact", "sedan", "coupe", "suv", "truck", "van", "exotic"])
    .optional(),
  variableOptionKey: z.string().trim().min(1).max(40).optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  discountCents: z.number().int().min(0).optional(),
});

export const sendQuoteInput = z.object({
  id: z.string().uuid(),
});

export const decideQuoteInput = z.object({
  token: z.string().min(1),
  action: z.enum(["approve", "decline"]),
  signatureName: z.string().trim().min(2).max(200).optional(),
  declinedReason: z.string().trim().max(500).optional(),
  acceptedUpsells: z.array(z.string().uuid()).default([]),
  acceptedTerms: z.boolean().default(false),
});
