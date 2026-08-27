import { z } from "zod";

const optionalTrimmed = z
  .string()
  .trim()
  .transform((v) => (v.length === 0 ? undefined : v))
  .optional();

export const deductRollInput = z.object({
  materialRollId: z.string().uuid(),
  jobId: z.string().uuid().nullable().optional(),
  lengthYd: z.number().positive().max(10_000),
  kind: z.enum(["deduct", "waste", "adjust"]).default("deduct"),
  notes: optionalTrimmed,
});

export const receiveRollInput = z.object({
  materialRollId: z.string().uuid(),
  lengthYd: z.number().positive().max(10_000),
  notes: optionalTrimmed,
});
