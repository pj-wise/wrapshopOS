import "server-only";

import { prisma } from "@/server/db";
import { inngest } from "@/server/jobs/client";

/**
 * Fan-out layer for user notifications.
 *
 * Domain code calls `dispatchNotification({...})` which:
 *   1. Writes a `Notification` row for each target user (bell + list).
 *   2. Optionally enqueues an `email.send` per user if their prefs allow it
 *      (per-user prefs table is Phase 8 — for now everyone-in-role gets in-app
 *      only unless emailEveryone is set).
 *
 * Targeting modes:
 *   - `userIds`: explicit list of user UUIDs
 *   - `roleKey`: all active org members whose role.key matches (e.g. "owner")
 *   - `everyone`: all active org members
 */

export type DispatchTarget =
  | { userIds: string[] }
  | { roleKey: string }
  | { everyone: true };

export type DispatchInput = {
  organizationId: string;
  type: string; // e.g. "job.delivered", "quote.approved", "invoice.paid"
  title: string;
  body?: string;
  entityRef?: {
    entityType?: string;
    entityId?: string;
    url?: string;
  };
  target: DispatchTarget;
  /** Also send an email to each target if their email is on file. */
  emailEveryone?: boolean;
  emailSubject?: string;
  emailText?: string;
};

export async function dispatchNotification(input: DispatchInput): Promise<void> {
  const userIds = await resolveTargets(input.organizationId, input.target);
  if (userIds.length === 0) return;

  const rows = userIds.map((uid) => ({
    organizationId: input.organizationId,
    userId: uid,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    entityRef: (input.entityRef ?? {}) as never,
  }));

  try {
    await prisma.notification.createMany({ data: rows });
  } catch (err) {
    console.error("[notifications.dispatch] createMany failed", { input, err });
    // Swallow — never fail the calling flow because notifications broke.
    return;
  }

  if (input.emailEveryone && input.emailSubject) {
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true },
    });
    for (const u of users) {
      if (!u.email) continue;
      try {
        await inngest.send({
          name: "email.send",
          data: {
            orgId: input.organizationId,
            to: u.email,
            subject: input.emailSubject,
            text: input.emailText ?? input.body ?? input.title,
            idempotencyKey: `notif:${input.type}:${input.entityRef?.entityId ?? "-"}:${u.id}`,
          },
        });
      } catch (err) {
        console.error("[notifications.dispatch] enqueue email failed", { userId: u.id, err });
      }
    }
  }
}

async function resolveTargets(
  organizationId: string,
  target: DispatchTarget,
): Promise<string[]> {
  if ("userIds" in target) return dedupe(target.userIds);
  const members = await prisma.orgMember.findMany({
    where: {
      organizationId,
      status: "active",
      ...("roleKey" in target ? { role: { key: target.roleKey } } : {}),
    },
    select: { userId: true },
  });
  return dedupe(members.map((m) => m.userId));
}

function dedupe(a: string[]): string[] {
  return Array.from(new Set(a));
}
