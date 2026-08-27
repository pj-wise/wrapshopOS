import "server-only";

import { inngest } from "../client";
import { prisma } from "@/server/db";
import { getEmailProvider } from "@/server/providers/registry";
import { recordTimelineEvent } from "@/server/audit/timeline";
import { dispatchNotification } from "@/server/services/notifications";
import { renderTemplate } from "@/lib/template-render";
import { buildMessageContext } from "@/server/services/context-builder";
import { env } from "@/env";

/**
 * job.delivered_aftermath — on job delivery:
 *   1. Materialize a Warranty per approved service that has an aftercare template
 *      linked to a service category (heuristic — real per-service warranty terms
 *      land as a service.warrantyMonths field in a later hardening pass).
 *   2. Send aftercare email if the org has a matching AftercareTemplate.
 *   3. Queue a ReviewRequest email using the shop's configured review URL.
 *   4. Notify shop team members via `dispatchNotification`.
 *
 * Idempotency:
 *   - Warranty: keyed by (jobId, serviceName) via app-layer duplicate check.
 *   - ReviewRequest: `[jobId, provider]` unique constraint prevents dupes.
 *   - Aftercare email: idempotencyKey `aftercare:${jobId}`.
 */
export const jobDeliveredAftermath = inngest.createFunction(
  {
    id: "job.delivered_aftermath",
    name: "Fire aftercare + warranty + review after delivery",
    retries: 3,
  },
  { event: "job.delivered" },
  async ({ event, step }) => {
    const { orgId, jobId, customerId } = event.data;

    return await step.run("aftermath", async () => {
      const job = await prisma.job.findFirst({
        where: { id: jobId, organizationId: orgId },
        include: {
          customer: { select: { id: true, name: true, email: true } },
          quote: {
            include: {
              items: {
                where: { OR: [{ isUpsell: false }, { upsellAccepted: true }] },
              },
            },
          },
        },
      });
      if (!job) return { skipped: true, reason: "job-not-found" };
      if (!job.customer) return { skipped: true, reason: "no-customer" };

      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { name: true, settings: true },
      });
      const settings = (org?.settings ?? {}) as {
        reviews?: {
          googleUrl?: string;
          yelpUrl?: string;
          facebookUrl?: string;
          manualUrl?: string;
          primary?: "google" | "yelp" | "facebook" | "manual";
        };
      };

      // ---- Warranty (rough MVP heuristic) ----
      const services = job.quote?.items ?? [];
      const distinctServiceNames = new Set(services.map((s) => s.description));
      let warrantiesCreated = 0;
      for (const name of distinctServiceNames) {
        const existing = await prisma.warranty.findFirst({
          where: { jobId, serviceName: name },
        });
        if (existing) continue;
        const termMonths = inferWarrantyMonths(name);
        if (termMonths === 0) continue;
        const installDate = job.deliveredAt ?? new Date();
        const expiresAt = new Date(installDate);
        expiresAt.setMonth(expiresAt.getMonth() + termMonths);
        await prisma.warranty.create({
          data: {
            organizationId: orgId,
            jobId,
            customerId,
            serviceName: name,
            termMonths,
            installDate,
            expiresAt,
          },
        });
        warrantiesCreated++;
      }

      // ---- Aftercare email ----
      let aftercareSent = false;
      if (job.customer.email) {
        // Prefer a template tied to the primary service's category if one exists.
        const template = await prisma.aftercareTemplate.findFirst({
          where: { organizationId: orgId, active: true, channel: "email" },
          orderBy: { serviceCategoryId: "desc" }, // prefer category-specific over org-default
        });
        if (template) {
          const context = await buildMessageContext({
            organizationId: orgId,
            customerId,
            jobId,
          });
          const subject = template.subject
            ? renderTemplate(template.subject, context)
            : `Thanks from ${org?.name ?? "your shop"}`;
          const body = renderTemplate(template.body, context);
          try {
            const provider = await getEmailProvider(orgId);
            await provider.send({
              to: job.customer.email,
              subject,
              text: body,
            });
            aftercareSent = true;
          } catch (err) {
            console.error("[aftermath] aftercare email failed", err);
          }
        }
      }

      // ---- Review request ----
      const primary = settings.reviews?.primary ?? "google";
      const url =
        settings.reviews?.[
          `${primary}Url` as "googleUrl" | "yelpUrl" | "facebookUrl" | "manualUrl"
        ] ?? null;
      let reviewRequestQueued = false;
      if (url && job.customer.email) {
        const existing = await prisma.reviewRequest.findFirst({
          where: { jobId, provider: primary },
        });
        if (!existing) {
          const req = await prisma.reviewRequest.create({
            data: {
              organizationId: orgId,
              jobId,
              customerId,
              channel: "email",
              provider: primary,
              url,
              queuedAt: new Date(),
            },
          });
          const shopName = org?.name ?? "your shop";
          const bounceUrl = `${env.NEXT_PUBLIC_APP_URL}/r/${req.id}`;
          try {
            const provider = await getEmailProvider(orgId);
            await provider.send({
              to: job.customer.email,
              subject: `How did we do?`,
              text: [
                `Hi ${job.customer.name.split(/\s+/)[0]},`,
                ``,
                `Thanks for coming to ${shopName}! If you loved the work, would you take 60 seconds to leave us a review?`,
                ``,
                bounceUrl,
                ``,
                `Thanks — the ${shopName} team`,
              ].join("\n"),
            });
            await prisma.reviewRequest.update({
              where: { id: req.id },
              data: { sentAt: new Date() },
            });
            reviewRequestQueued = true;
          } catch (err) {
            console.error("[aftermath] review email failed", err);
          }
        }
      }

      // ---- Notify shop team ----
      await dispatchNotification({
        organizationId: orgId,
        type: "job.delivered",
        title: `Job J-${String(job.number).padStart(4, "0")} delivered`,
        body: `${job.customer.name} — ${job.title ?? job.summary ?? ""}`.trim(),
        entityRef: { entityType: "job", entityId: jobId, url: `/jobs/${jobId}` },
        target: { roleKey: "owner" },
      });

      await recordTimelineEvent(orgId, {
        entityType: "job" as never,
        entityId: jobId,
        kind: "job.aftermath_completed",
        data: { warrantiesCreated, aftercareSent, reviewRequestQueued },
      });

      return { warrantiesCreated, aftercareSent, reviewRequestQueued };
    });
  },
);

/**
 * Very lightweight heuristic mapping service description → warranty months.
 * Real terms should be defined on the Service model in a future hardening
 * pass — for MVP this covers the common shop menu.
 */
function inferWarrantyMonths(desc: string): number {
  const s = desc.toLowerCase();
  if (s.includes("ceramic coating level 3")) return 60;
  if (s.includes("ceramic coating level 2")) return 36;
  if (s.includes("ceramic coating level 1")) return 12;
  if (s.includes("full body ppf")) return 120; // 10yr common for XPEL/STEK
  if (s.includes("full front ppf")) return 120;
  if (s.includes("track pack ppf")) return 120;
  if (s.includes("ppf")) return 120;
  if (s.includes("wrap")) return 24; // vinyl typical 2-3yr shop warranty
  if (s.includes("tint")) return 120; // lifetime for premium ceramic tint
  return 0;
}
