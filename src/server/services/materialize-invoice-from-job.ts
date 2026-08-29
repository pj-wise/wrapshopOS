import "server-only";

import { prisma } from "@/server/db";
import { inngest } from "@/server/jobs/client";
import { isAccountingConnected } from "@/server/providers/registry";
import { recordTimelineEvent } from "@/server/audit/timeline";

/**
 * Materialize an Invoice for a Job. Idempotent by jobId — if an Invoice
 * already exists for the Job, we return it instead of creating a duplicate.
 *
 * Called from three paths:
 *   1. Portal `decideQuote` (approve) — invoice appears immediately so the
 *      customer's deposit / balance flow is unified.
 *   2. `job.create_from_quote` Inngest handler (backfill / admin approvals).
 *   3. `invoice.create_from_delivered_job` Inngest handler (backstop for
 *      jobs that skipped the approval path — created directly, no quote).
 *
 * Also stubs the Deposit row when `Quote.depositCents > 0` so the shop
 * can see the outstanding deposit ask. The Payment lands separately when
 * the customer pays via the portal or the shop records it manually.
 */
export async function materializeInvoiceFromJob(
  orgId: string,
  jobId: string,
  opts: { status?: "draft" | "sent" } = {},
): Promise<{ invoiceId: string; number: number; created: boolean }> {
  const existing = await prisma.invoice.findFirst({
    where: { jobId, deletedAt: null },
    select: { id: true, number: true },
  });
  if (existing) {
    return { invoiceId: existing.id, number: existing.number, created: false };
  }

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
  if (!job) {
    return { invoiceId: "", number: 0, created: false };
  }

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
      status: opts.status ?? "sent",
      currency: job.quote?.currency ?? "USD",
      subtotalCents,
      discountCents,
      taxCents,
      totalCents,
      balanceCents: totalCents,
      // sentAt is intentionally NOT set here — it tracks the customer
      // email dispatch, not the invoice status. The invoice-email-send
      // handler stamps it when the notification actually goes out.
      items: { createMany: { data: lines } },
    },
  });

  // Deposit stub — records the ask when the quote configured one. Payment
  // lands separately (portal or shop-side "record payment"), which will
  // flip Deposit.status to "paid" and stamp qboPaymentId.
  if (job.quote?.depositCents && job.quote.depositCents > 0) {
    const existingDeposit = await prisma.deposit.findFirst({
      where: { organizationId: orgId, quoteId: job.quote.id },
      select: { id: true },
    });
    if (!existingDeposit) {
      await prisma.deposit.create({
        data: {
          organizationId: orgId,
          quoteId: job.quote.id,
          customerId: job.customerId,
          amountCents: job.quote.depositCents,
          status: "requested",
        },
      });
    }
  }

  await recordTimelineEvent(orgId, {
    entityType: "customer",
    entityId: job.customerId,
    kind: "invoice.created",
    data: { invoiceId: invoice.id, invoiceNumber: invoice.number, jobId: job.id },
  });

  if (await isAccountingConnected(orgId)) {
    await inngest
      .send({
        name: "qbo.sync.invoice",
        data: { orgId, invoiceId: invoice.id },
      })
      .catch((err) => console.error("[invoice.materialize] inngest send failed", err));
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { qboSyncStatus: "syncing" },
    });
    // Email will be dispatched by qbo.sync.invoice once we have a payLink.
  } else {
    // No QBO — email immediately with the "reply to arrange payment" copy.
    // Once QBO is connected the shop can resend for the pay-link version.
    await inngest
      .send({
        name: "invoice.email.send",
        data: { orgId, invoiceId: invoice.id, kind: "initial" },
      })
      .catch((err) =>
        console.error("[invoice.materialize] invoice.email.send failed", err),
      );
  }

  return { invoiceId: invoice.id, number: invoice.number, created: true };
}
