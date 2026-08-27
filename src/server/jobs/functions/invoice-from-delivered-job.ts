import "server-only";

import { inngest } from "../client";
import { prisma } from "@/server/db";
import { isAccountingConnected } from "@/server/providers/registry";
import { recordTimelineEvent } from "@/server/audit/timeline";

/**
 * invoice.create_from_delivered_job — reuses the tRPC createFromJob logic
 * without the http round-trip. Fires on job.delivered before the aftercare
 * flow runs. Idempotent by jobId (skips if invoice already exists).
 */
export const invoiceFromDeliveredJob = inngest.createFunction(
  {
    id: "invoice.create_from_delivered_job",
    name: "Auto-create Invoice when Job delivered",
    retries: 2,
  },
  { event: "job.delivered" },
  async ({ event, step }) => {
    const { orgId, jobId } = event.data;

    return await step.run("create-invoice", async () => {
      const existing = await prisma.invoice.findFirst({
        where: { jobId, deletedAt: null },
      });
      if (existing) return { skipped: true, reason: "invoice-exists", invoiceId: existing.id };

      const job = await prisma.job.findFirst({
        where: { id: jobId, organizationId: orgId, deletedAt: null },
        include: {
          quote: {
            include: {
              items: {
                where: { OR: [{ isUpsell: false }, { upsellAccepted: true }] },
                orderBy: { sortOrder: "asc" },
              },
            },
          },
        },
      });
      if (!job) return { skipped: true, reason: "job-not-found" };

      const lines = (job.quote?.items ?? []).map((li, i) => ({
        organizationId: orgId,
        description: li.description,
        quantity: Number(li.quantity),
        unit: li.unit,
        unitPriceCents: li.unitPriceCents,
        discountCents: li.discountCents,
        totalCents: li.totalCents,
        taxable: li.taxable,
        sortOrder: i,
      }));

      const subtotalCents = lines.reduce(
        (s, l) => s + Math.round(l.unitPriceCents * l.quantity),
        0,
      );
      const discountCents = lines.reduce((s, l) => s + l.discountCents, 0);
      const totalCents = job.quote?.totalCents ?? subtotalCents - discountCents;
      const taxCents = job.quote?.taxCents ?? 0;

      const last = await prisma.invoice.findFirst({
        where: { organizationId: orgId },
        orderBy: { number: "desc" },
        select: { number: true },
      });
      const number = (last?.number ?? 0) + 1;

      const invoice = await prisma.invoice.create({
        data: {
          organizationId: orgId,
          customerId: job.customerId,
          jobId: job.id,
          quoteId: job.quoteId,
          number,
          status: "draft",
          currency: job.quote?.currency ?? "USD",
          subtotalCents,
          discountCents,
          taxCents,
          totalCents,
          balanceCents: totalCents,
          items: { createMany: { data: lines } },
        },
      });

      await recordTimelineEvent(orgId, {
        entityType: "customer",
        entityId: job.customerId,
        kind: "invoice.auto_created",
        data: { invoiceId: invoice.id, invoiceNumber: invoice.number, jobId: job.id },
      });

      if (await isAccountingConnected(orgId)) {
        await inngest.send({
          name: "qbo.sync.invoice",
          data: { orgId, invoiceId: invoice.id },
        });
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { qboSyncStatus: "syncing" },
        });
      }

      return { invoiceId: invoice.id, number: invoice.number };
    });
  },
);
