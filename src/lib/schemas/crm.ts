import { z } from "zod";

import {
  CUSTOMER_TYPES,
  LEAD_SOURCE_KEYS,
  LEAD_STAGE_KEYS,
  PREFERRED_CONTACT,
} from "@/lib/crm-catalog";

const nonEmptyString = z.string().trim().min(1);
const optionalTrimmed = z
  .string()
  .trim()
  .transform((v) => (v.length === 0 ? undefined : v))
  .optional();

// Very forgiving VIN validation — 17 chars, no I/O/Q. NHTSA gives errors we
// surface separately, so we don't want to block a slightly wrong VIN.
const vinField = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .refine((v) => v.length === 0 || v.length === 17, { message: "VIN must be 17 characters" })
  .refine((v) => v.length === 0 || /^[A-HJ-NPR-Z0-9]{17}$/i.test(v), {
    message: "VIN contains invalid characters",
  })
  .transform((v) => (v.length === 0 ? undefined : v))
  .optional();

// -------- Customers --------

export const createCustomerInput = z.object({
  type: z.enum(CUSTOMER_TYPES.map((t) => t.key) as [string, ...string[]]).default("individual"),
  name: nonEmptyString.max(200),
  businessName: optionalTrimmed,
  email: z.string().trim().email().optional().or(z.literal("").transform(() => undefined)),
  phone: optionalTrimmed,
  altPhone: optionalTrimmed,
  addressLine1: optionalTrimmed,
  addressLine2: optionalTrimmed,
  city: optionalTrimmed,
  region: optionalTrimmed,
  postalCode: optionalTrimmed,
  country: z.string().length(2).default("US"),
  tags: z.array(z.string().trim().min(1)).default([]),
  notes: optionalTrimmed,
  marketingConsent: z.boolean().default(false),
  referralSource: optionalTrimmed,
});

export const updateCustomerInput = createCustomerInput.partial().extend({
  id: z.string().uuid(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerInput>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerInput>;

// -------- Vehicles --------

export const createVehicleInput = z.object({
  customerId: z.string().uuid().optional(),
  vin: vinField,
  year: z.number().int().min(1900).max(2100).nullable().optional(),
  make: optionalTrimmed,
  model: optionalTrimmed,
  trim: optionalTrimmed,
  bodyStyle: optionalTrimmed,
  color: optionalTrimmed,
  plate: optionalTrimmed,
  plateState: optionalTrimmed,
  mileage: z.number().int().min(0).nullable().optional(),
  notes: optionalTrimmed,
  decodedData: z.record(z.string(), z.unknown()).optional(),
});

export const updateVehicleInput = createVehicleInput.partial().extend({
  id: z.string().uuid(),
});

export const decodeVinInput = z.object({
  vin: z.string().trim().transform((v) => v.toUpperCase()),
});

export type CreateVehicleInput = z.infer<typeof createVehicleInput>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleInput>;

// -------- Leads --------

export const createLeadInput = z.object({
  name: nonEmptyString.max(200),
  email: z.string().trim().email().optional().or(z.literal("").transform(() => undefined)),
  phone: optionalTrimmed,
  preferredContact: z
    .enum(PREFERRED_CONTACT.map((c) => c.key) as [string, ...string[]])
    .optional(),
  budgetCents: z.number().int().min(0).nullable().optional(),
  source: z.enum(LEAD_SOURCE_KEYS as [string, ...string[]]).default("other"),
  status: z.enum(LEAD_STAGE_KEYS as [string, ...string[]]).default("new"),
  requestedServices: z.array(z.string().trim().min(1)).default([]),
  vehicleDescription: optionalTrimmed,
  tags: z.array(z.string().trim().min(1)).default([]),
  notes: optionalTrimmed,
  assignedToUserId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  followUpAt: z.coerce.date().optional(),
});

export const updateLeadInput = createLeadInput.partial().extend({
  id: z.string().uuid(),
});

export const convertLeadInput = z.object({
  id: z.string().uuid(),
  customerType: z
    .enum(CUSTOMER_TYPES.map((t) => t.key) as [string, ...string[]])
    .default("individual"),
  // Optional VIN — if supplied we decode & create a Vehicle attached to
  // the new customer. Otherwise the lead's vehicleDescription is preserved
  // as a note on the vehicle.
  vin: vinField,
  createEmptyVehicle: z.boolean().default(false),
});

export type CreateLeadInput = z.infer<typeof createLeadInput>;
export type UpdateLeadInput = z.infer<typeof updateLeadInput>;
export type ConvertLeadInput = z.infer<typeof convertLeadInput>;

// -------- Search --------

export const globalSearchInput = z.object({
  q: z.string().trim().min(1).max(200),
  limit: z.number().int().min(1).max(20).default(8),
});
