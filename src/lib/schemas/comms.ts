import { z } from "zod";

const optionalTrimmed = z
  .string()
  .trim()
  .transform((v) => (v.length === 0 ? undefined : v))
  .optional();

// -------- Messages --------

export const sendReplyInput = z.object({
  threadId: z.string().uuid(),
  bodyText: z.string().trim().min(1).max(10_000),
  bodyHtml: z.string().max(50_000).optional(),
  subject: optionalTrimmed,
  attachmentFileIds: z.array(z.string().uuid()).default([]),
});

export const composeMessageInput = z.object({
  customerId: z.string().uuid(),
  channel: z.enum(["email", "sms", "internal"]).default("email"),
  subject: optionalTrimmed,
  bodyText: z.string().trim().min(1).max(10_000),
  bodyHtml: z.string().max(50_000).optional(),
  attachmentFileIds: z.array(z.string().uuid()).default([]),
  templateId: z.string().uuid().optional(),
});

export const assignThreadInput = z.object({
  id: z.string().uuid(),
  assignedToUserId: z.string().uuid().nullable(),
});

// -------- Templates --------

export const upsertTemplateInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(80),
  channel: z.enum(["email", "sms"]).default("email"),
  subject: optionalTrimmed,
  body: z.string().trim().min(1).max(20_000),
});

export const renderTemplateInput = z.object({
  templateId: z.string().uuid(),
  customerId: z.string().uuid().optional(),
  quoteId: z.string().uuid().optional(),
  jobId: z.string().uuid().optional(),
});
