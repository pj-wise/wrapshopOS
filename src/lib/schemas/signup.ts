import { z } from "zod";

/**
 * Canonical service keys used server-side. UI labels live in the form.
 */
export const SERVICE_KEYS = [
  "wrap",
  "tint",
  "ppf",
  "ceramic",
  "detailing",
  "other",
] as const;
export type ServiceKey = (typeof SERVICE_KEYS)[number];

/**
 * Optional questionnaire values. Aligns with the dropdown options on the form.
 * "none" = user selected "Nothing yet"; "other" catches long-tail providers.
 */
export const SCHEDULING_TOOLS = [
  "none",
  "google_calendar",
  "acuity",
  "booksy",
  "paper",
  "other",
] as const;
export type SchedulingTool = (typeof SCHEDULING_TOOLS)[number];

export const INVOICING_TOOLS = [
  "none",
  "quickbooks",
  "square",
  "stripe",
  "paypal",
  "pdf",
  "other",
] as const;
export type InvoicingTool = (typeof INVOICING_TOOLS)[number];

const optionalTrimmed = z
  .string()
  .trim()
  .transform((v) => (v.length === 0 ? undefined : v))
  .optional();

/**
 * The complete signup payload. Client validates via the same schema, so
 * server-side errors mean either a client bypass attempt or Supabase-side
 * problems (dup email, weak password) — those come through as strings on
 * the server action's `{ ok: false, error }` response.
 */
export const signUpInput = z.object({
  // Account holder
  email: z.string().trim().toLowerCase().email("Please enter a valid email."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(72, "Password is too long."),
  firstName: z.string().trim().min(1, "Required").max(60),
  lastName: z.string().trim().min(1, "Required").max(60),
  personalPhone: optionalTrimmed,

  // Business
  businessName: z.string().trim().min(2, "Required").max(80),
  shopPhone: z.string().trim().min(7, "Enter a valid phone.").max(30),
  servicesOffered: z
    .array(z.enum(SERVICE_KEYS))
    .min(1, "Pick at least one service.")
    .max(SERVICE_KEYS.length),

  // Questionnaire (optional)
  currentScheduling: z.enum(SCHEDULING_TOOLS).optional(),
  currentInvoicing: z.enum(INVOICING_TOOLS).optional(),
});

export type SignUpInput = z.infer<typeof signUpInput>;
