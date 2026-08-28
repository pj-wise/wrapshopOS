import "server-only";

import type { PrismaClient } from "@prisma/client";

import { recordTimelineEvent } from "@/server/audit/timeline";

/**
 * Shared "the check-in is done — flip the job" transition. Used by three
 * paths that all end here:
 *
 *   1. `jobs.submitCheckIn` — legacy inline form (Starter tier, or a shop
 *      opting for the desktop-only flow).
 *   2. `checkIn.completePrep` — mobile-photo flow, called when the tech
 *      taps Done on their phone.
 *   3. `checkIn.optOutPhotos` — the acknowledged "skip photos" path.
 *
 * Owns:
 *   - Upserting the `CheckIn` row.
 *   - Flipping the job to `status: "checked_in"` + stamping `actualStart`.
 *   - Emitting the timeline event.
 *
 * Idempotent: safe to call multiple times for the same job — the CheckIn is
 * keyed by unique `jobId` and the status update is idempotent by
 * construction.
 */
export type FinalizeCheckInInput = {
  jobId: string;
  organizationId: string;
  performedByUserId: string;
  /** Whatever fields the caller collected — legacy form, mobile, or opt-out. */
  patch: Record<string, unknown>;
  /** Human hint for the timeline event. */
  reason: "form" | "mobile_photos" | "opt_out";
  timelineData?: Record<string, unknown>;
};

export async function finalizeCheckIn(
  prisma: PrismaClient,
  input: FinalizeCheckInInput,
): Promise<{ checkInId: string }> {
  const existing = await prisma.checkIn.findFirst({
    where: { jobId: input.jobId },
    select: { id: true },
  });

  const data = {
    ...input.patch,
    organizationId: input.organizationId,
    performedByUserId: input.performedByUserId,
  } as never;

  const checkIn = existing
    ? await prisma.checkIn.update({ where: { id: existing.id }, data })
    : await prisma.checkIn.create({
        data: { ...(data as object), jobId: input.jobId } as never,
      });

  await prisma.job.update({
    where: { id: input.jobId },
    data: { status: "checked_in", actualStart: new Date() },
  });

  await recordTimelineEvent(input.organizationId, {
    entityType: "job" as never,
    entityId: input.jobId,
    kind:
      input.reason === "opt_out"
        ? "job.checked_in_opt_out"
        : input.reason === "mobile_photos"
          ? "job.checked_in_mobile"
          : "job.checked_in",
    actorUserId: input.performedByUserId,
    data: input.timelineData ?? {},
  });

  return { checkInId: checkIn.id };
}
