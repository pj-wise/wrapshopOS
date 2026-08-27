import "server-only";

import { inngest } from "../client";
import { prisma } from "@/server/db";
import { getAccountingProvider } from "@/server/providers/registry";

/**
 * qbo.sync.invoice — push a local Invoice into QuickBooks, capture the pay
 * link, and stamp qboInvoiceId + qboSyncStatus back on the row.
 *
 * Also ensures the customer exists in QBO first (upserting by email) via
 * the accounting provider's syncCustomer path.
 *
 * Idempotency: keyed by `qbo:invoice:${invoiceId}:${version}` via
 * AccountingSyncRecord. If we already synced this invoice at its current
 * updatedAt we return early.
 */
export const qboSyncInvoice = inngest.createFunction(
  {
    id: "qbo.sync.invoice",
    name: "Sync Invoice to QuickBooks",
    retries: 5,
  },
  { event: "qbo.sync.invoice" },
  async ({ event, step }) => {
    const { orgId, invoiceId } = event.data;

    return await step.run("sync", async () => {
      const invoice = await prisma.invoice.findFirst({
        where: { id: invoiceId, organizationId: orgId, deletedAt: null },
        include: {
          customer: true,
          items: { orderBy: { sortOrder: "asc" } },
        },
      });
      if (!invoice) return { skipped: true, reason: "invoice-not-found" };
      if (invoice.status === "void") return { skipped: true, reason: "invoice-voided" };

      const idempotencyKey = `qbo:invoice:${invoice.id}:${invoice.updatedAt.toISOString()}`;

      const existing = await prisma.accountingSyncRecord.findFirst({
        where: { idempotencyKey },
      });
      if (existing?.status === "synced") {
        return { skipped: true, reason: "already-synced", externalId: existing.externalId };
      }

      let provider;
      try {
        provider = await getAccountingProvider(orgId);
      } catch (err) {
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            qboSyncStatus: "disconnected",
            qboSyncError: err instanceof Error ? err.message : String(err),
          },
        });
        return {
          skipped: true,
          reason: "accounting-disconnected",
          error: err instanceof Error ? err.message : String(err),
        };
      }

      try {
        // Ensure customer exists in QBO first.
        const customerRes = await provider.syncCustomer({
          localId: invoice.customerId,
          displayName: invoice.customer.name,
          email: invoice.customer.email ?? undefined,
          phone: invoice.customer.phone ?? undefined,
          externalId: invoice.customer.qboCustomerId ?? undefined,
        });

        const created = await provider.createInvoice({
          customerExternalId: customerRes.externalId,
          number: `INV-${String(invoice.number).padStart(4, "0")}`,
          lines: invoice.items.map((i) => ({
            description: i.description,
            quantity: Number(i.quantity),
            unitPriceCents: i.unitPriceCents,
            taxable: i.taxable,
          })),
          dueDate: invoice.dueDate?.toISOString().slice(0, 10),
          memo: invoice.memo ?? undefined,
          allowOnlinePayment: true,
        });

        await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            qboInvoiceId: created.externalId,
            qboSyncedAt: new Date(),
            qboSyncStatus: "synced",
            qboSyncError: null,
            qboPayLink: created.payLinkUrl ?? null,
            status: invoice.status === "draft" ? "sent" : invoice.status,
            sentAt: invoice.sentAt ?? new Date(),
          },
        });

        await prisma.accountingSyncRecord.upsert({
          where: { idempotencyKey },
          create: {
            organizationId: orgId,
            provider: "quickbooks",
            entityType: "invoice",
            entityId: invoice.id,
            externalId: created.externalId,
            idempotencyKey,
            status: "synced",
            syncedAt: new Date(),
          },
          update: {
            externalId: created.externalId,
            status: "synced",
            syncedAt: new Date(),
            errorMessage: null,
          },
        });

        return { synced: true, externalId: created.externalId, payLink: created.payLinkUrl ?? null };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { qboSyncStatus: "error", qboSyncError: message },
        });
        await prisma.accountingSyncRecord.upsert({
          where: { idempotencyKey },
          create: {
            organizationId: orgId,
            provider: "quickbooks",
            entityType: "invoice",
            entityId: invoice.id,
            idempotencyKey,
            status: "error",
            errorMessage: message,
          },
          update: { status: "error", errorMessage: message },
        });
        throw err; // let Inngest retry
      }
    });
  },
);
