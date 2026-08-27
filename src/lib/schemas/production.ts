import { z } from "zod";

import { JOB_PRIORITIES, JOB_STAGE_KEYS, PHOTO_PHASES } from "@/lib/production-catalog";
import { EVENT_COLOR_KEYS, HEX_RE } from "@/lib/event-catalog";

const optionalTrimmed = z
  .string()
  .trim()
  .transform((v) => (v.length === 0 ? undefined : v))
  .optional();

const jobStatus = z.enum(JOB_STAGE_KEYS as [string, ...string[]]);
const jobPriority = z.enum(JOB_PRIORITIES.map((p) => p.key) as [string, ...string[]]);
const photoPhase = z.enum(PHOTO_PHASES.map((p) => p.key) as [string, ...string[]]);

export const updateJobInput = z.object({
  id: z.string().uuid(),
  status: jobStatus.optional(),
  priority: jobPriority.optional(),
  title: optionalTrimmed,
  summary: optionalTrimmed,
  bayId: z.string().uuid().nullable().optional(),
  assignedTechIds: z.array(z.string().uuid()).optional(),
  scheduledStart: z.coerce.date().nullable().optional(),
  scheduledEnd: z.coerce.date().nullable().optional(),
  estimatedHours: z.number().min(0).nullable().optional(),
});

export const checkInInput = z.object({
  jobId: z.string().uuid(),
  mileage: z.number().int().min(0).nullable().optional(),
  fuelLevelEighths: z.number().int().min(0).max(8).nullable().optional(),
  exteriorConditionJson: z.record(z.string(), z.unknown()).default({}),
  interiorConditionJson: z.record(z.string(), z.unknown()).default({}),
  damagePhotoFileIds: z.array(z.string().uuid()).default([]),
  overallPhotoFileIds: z.array(z.string().uuid()).default([]),
  warningLights: z.array(z.string()).default([]),
  keysReceived: z.number().int().min(0).default(1),
  belongingsAcknowledged: z.boolean().default(false),
  customerSignatureUrl: optionalTrimmed,
  customerSignatureName: optionalTrimmed,
});

export const qcCheckInput = z.object({
  jobId: z.string().uuid(),
  passed: z.boolean(),
  notes: optionalTrimmed,
  punchListJson: z
    .array(
      z.object({
        label: z.string(),
        resolved: z.boolean().default(false),
        resolvedAt: z.coerce.date().nullable().optional(),
        note: z.string().optional(),
      }),
    )
    .default([]),
  photoFileIds: z.array(z.string().uuid()).default([]),
});

export const addJobPhotoInput = z.object({
  jobId: z.string().uuid(),
  fileId: z.string().uuid(),
  phase: photoPhase,
  caption: optionalTrimmed,
});

export const completeChecklistItemInput = z.object({
  id: z.string().uuid(),
  note: optionalTrimmed,
  photoFileIds: z.array(z.string().uuid()).default([]),
});

// -------- Bays --------

export const upsertBayInput = z.object({
  id: z.string().uuid().optional(),
  locationId: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  capabilities: z.array(z.string()).default([]),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
});

// -------- Scheduling --------

export const createScheduleBlockInput = z.object({
  jobId: z.string().uuid().nullable().optional(),
  bayId: z.string().uuid().nullable().optional(),
  techUserId: z.string().uuid().nullable().optional(),
  start: z.coerce.date(),
  end: z.coerce.date(),
  kind: z
    .enum(["job", "consult", "inspection", "meeting", "other", "block"])
    .default("job"),
  title: optionalTrimmed,
  notes: optionalTrimmed,
  color: z
    .union([
      z.enum(EVENT_COLOR_KEYS as [string, ...string[]]),
      z.string().regex(HEX_RE, "Must be a hex color like #abc or #aabbcc"),
    ])
    .nullable()
    .optional(),
});

export const updateScheduleBlockInput = createScheduleBlockInput.partial().extend({
  id: z.string().uuid(),
});

// -------- Time entries --------

export const clockInInput = z.object({
  jobId: z.string().uuid().nullable().optional(),
  notes: optionalTrimmed,
});

export const clockOutInput = z.object({
  id: z.string().uuid(),
  breakMinutes: z.number().int().min(0).max(600).default(0),
  notes: optionalTrimmed,
});
