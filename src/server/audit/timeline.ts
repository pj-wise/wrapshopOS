import "server-only";

import { prisma } from "@/server/db";

/**
 * TimelineEvent writer — records domain events (create/update/convert/etc.)
 * to the unified per-entity timeline. Never fails the caller.
 *
 * This is separate from the AuditLog (which captures raw mutation intent).
 * Timeline is the *narrative* the shop sees on a customer/vehicle/job
 * detail page: "Marcus called, quote sent, deposit paid, job checked in..."
 */
export type TimelineEventInput = {
  entityType: "customer" | "vehicle" | "lead" | "job" | "quote" | "invoice";
  entityId: string;
  kind: string;
  actorUserId?: string | null;
  data?: Record<string, unknown>;
  occurredAt?: Date;
};

export async function recordTimelineEvent(
  organizationId: string,
  input: TimelineEventInput,
): Promise<void> {
  try {
    await prisma.timelineEvent.create({
      data: {
        organizationId,
        entityType: input.entityType,
        entityId: input.entityId,
        kind: input.kind,
        actorUserId: input.actorUserId ?? null,
        data: (input.data ?? {}) as never,
        occurredAt: input.occurredAt ?? new Date(),
      },
    });
  } catch (err) {
    console.error("[timeline] write failed", { input, err });
  }
}
