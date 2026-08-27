import { z } from "zod";

const optionalTrimmed = z
  .string()
  .trim()
  .transform((v) => (v.length === 0 ? undefined : v))
  .optional();

export const createInvoiceFromJobInput = z.object({
  jobId: z.string().uuid(),
  dueDate: z.coerce.date().nullable().optional(),
  memo: optionalTrimmed,
  autoSyncToQbo: z.boolean().default(true),
});

export const recordPaymentInput = z.object({
  invoiceId: z.string().uuid().nullable().optional(),
  customerId: z.string().uuid().nullable().optional(),
  amountCents: z.number().int().min(1),
  method: z.enum(["card", "ach", "cash", "check", "qbo", "other"]).default("other"),
  referenceNumber: optionalTrimmed,
  notes: optionalTrimmed,
  receivedAt: z.coerce.date().optional(),
});

export const voidInvoiceInput = z.object({
  id: z.string().uuid(),
  reason: optionalTrimmed,
});
