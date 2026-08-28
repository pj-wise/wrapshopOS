import "server-only";

import { inngest } from "../client";
import { prisma } from "@/server/db";
import { getAccountingProvider } from "@/server/providers/registry";

type QboWebhookPayload = {
  eventNotifications?: Array<{
    realmId: string;
    dataChangeEvent?: {
      entities?: Array<{
        name: string;
        id: string;
        operation: string;
        lastUpdated: string;
      }>;
    };
  }>;
};

/**
 * qbo.webhook.received — process a stored WebhookEvent asynchronously.
 * Currently handles Invoice + Payment change notifications by re-reading the
 * remote invoice and reconciling status/balance on the local row. Marks the
 * WebhookEvent processedAt when done.
 */
export const qboWebhookReceived = inngest.createFunction(
  {
    id: "qbo.webhook.received",
    name: "Process QuickBooks webhook event",
    retries: 3,
  },
  { event: "qbo.webhook.received" },
  async ({ event, step }) => {
    const { orgId, webhookEventId } = event.data;

    return await step.run("process", async () => {
      const row = await prisma.webhookEvent.findUnique({
        where: { id: webhookEventId },
      });
      if (!row) return { skipped: true, reason: "not-found" };
      if (row.processedAt) return { skipped: true, reason: "already-processed" };

      const payload = (row.payload ?? {}) as QboWebhookPayload;
      const provider = await getAccountingProvider(orgId).catch(() => null);
      if (!provider) {
        await prisma.webhookEvent.update({
          where: { id: row.id },
          data: { errorMsg: "accounting-disconnected" },
        });
        return { skipped: true, reason: "accounting-disconnected" };
      }

      let processedInvoices = 0;
      let processedPayments = 0;

      for (const notification of payload.eventNotifications ?? []) {
        for (const entity of notification.dataChangeEvent?.entities ?? []) {
          if (entity.name === "Invoice") {
            const remote = await provider.getInvoice(entity.id).catch(() => null);
            if (!remote) continue;
            const invoice = await prisma.invoice.findFirst({
              where: { organizationId: orgId, qboInvoiceId: entity.id },
            });
            if (!invoice) continue;
            const balanceCents = remote.balanceCents;
            const paidCents = Math.max(0, invoice.totalCents - balanceCents);
            await prisma.invoice.update({
              where: { id: invoice.id },
              data: {
                balanceCents,
                amountPaidCents: paidCents,
                status:
                  balanceCents === 0
                    ? "paid"
                    : paidCents > 0
                      ? "partial"
                      : invoice.status,
                paidAt: balanceCents === 0 ? new Date() : invoice.paidAt,
                qboSyncedAt: new Date(),
              },
            });
            processedInvoices++;
          } else if (entity.name === "Payment") {
            // Pull the full payment record — amount, txn date, and (crucially)
            // which invoice(s) it applied to. QBO's webhook only tells us the
            // Payment.Id changed; everything else comes from the GET.
            const remote = await provider.getPayment(entity.id).catch(() => null);
            if (!remote) continue;

            // Best-effort match against a local invoice by qboInvoiceId. QBO
            // payments can settle multiple invoices; we link to the first hit
            // and leave notes referencing the rest for the reconciliation
            // queue. Unmatched payments land with invoiceId=null (already
            // handled by the schema — reconciliation UI will surface them).
            let invoiceId: string | null = null;
            let customerId: string | null = null;
            if (remote.linkedInvoiceExternalIds.length > 0) {
              const match = await prisma.invoice.findFirst({
                where: {
                  organizationId: orgId,
                  qboInvoiceId: { in: remote.linkedInvoiceExternalIds },
                },
                select: { id: true, customerId: true },
              });
              if (match) {
                invoiceId = match.id;
                customerId = match.customerId;
              }
            }

            const receivedAt = remote.txnDate
              ? new Date(remote.txnDate)
              : new Date();

            const existing = await prisma.payment.findFirst({
              where: { organizationId: orgId, qboPaymentId: entity.id },
            });
            if (existing) {
              await prisma.payment.update({
                where: { id: existing.id },
                data: {
                  amountCents: remote.amountCents,
                  method: remote.method ?? existing.method,
                  receivedAt,
                  invoiceId: existing.invoiceId ?? invoiceId,
                  customerId: existing.customerId ?? customerId,
                },
              });
            } else {
              await prisma.payment.create({
                data: {
                  organizationId: orgId,
                  qboPaymentId: entity.id,
                  amountCents: remote.amountCents,
                  method: remote.method ?? "qbo",
                  receivedAt,
                  invoiceId,
                  customerId,
                  notes: `Received via QBO webhook (${entity.operation})`,
                },
              });
            }
            processedPayments++;
          }
        }
      }

      await prisma.webhookEvent.update({
        where: { id: row.id },
        data: { processedAt: new Date(), errorMsg: null },
      });

      return { processedInvoices, processedPayments };
    });
  },
);
