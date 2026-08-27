import "server-only";

import type {
  AccountingCustomer,
  AccountingInvoice,
  AccountingLineItem,
  AccountingProvider,
} from "../types";
import { getQuickBooksClient } from "@/server/integrations/quickbooks/client";
import { prisma } from "@/server/db";

/**
 * QuickBooksAccountingProvider — thin adapter over the low-level
 * QuickBooksClient that produces the org-neutral shapes the AccountingProvider
 * interface requires.
 *
 * `syncCustomer` also stashes the QBO Customer.Id back on the local Customer
 * row (qboCustomerId) so subsequent invoice creates can skip the lookup.
 */
export function createQuickBooksAccountingProvider(orgId: string): AccountingProvider {
  return {
    name: "quickbooks",

    async healthCheck() {
      const start = Date.now();
      try {
        const client = await getQuickBooksClient(orgId);
        await client.getCompanyInfo();
        return {
          ok: true,
          latencyMs: Date.now() - start,
          checkedAt: new Date().toISOString(),
        };
      } catch (err) {
        return {
          ok: false,
          latencyMs: Date.now() - start,
          message: err instanceof Error ? err.message : String(err),
          checkedAt: new Date().toISOString(),
        };
      }
    },

    async syncCustomer(input): Promise<AccountingCustomer> {
      const client = await getQuickBooksClient(orgId);

      // If we already have a QBO id on the local record, use it (upsert path
      // will land in a follow-up; MVP just returns the existing id).
      if (input.externalId) {
        return {
          externalId: input.externalId,
          displayName: input.displayName,
          email: input.email,
          phone: input.phone,
        };
      }

      // Best-effort dedupe by email.
      if (input.email) {
        const found = await client.findCustomerByEmail(input.email);
        const existing = found.QueryResponse?.Customer?.[0];
        if (existing) {
          await prisma.customer.update({
            where: { id: input.localId },
            data: { qboCustomerId: existing.Id },
          });
          return {
            externalId: existing.Id,
            displayName: input.displayName,
            email: input.email,
            phone: input.phone,
          };
        }
      }

      const created = await client.createCustomer({
        displayName: input.displayName,
        email: input.email,
        phone: input.phone,
      });
      await prisma.customer.update({
        where: { id: input.localId },
        data: { qboCustomerId: created.Customer.Id },
      });
      return {
        externalId: created.Customer.Id,
        displayName: input.displayName,
        email: input.email,
        phone: input.phone,
      };
    },

    async createInvoice(input): Promise<AccountingInvoice> {
      const client = await getQuickBooksClient(orgId);
      const res = await client.createInvoice({
        customerExternalId: input.customerExternalId,
        number: input.number,
        lines: input.lines,
        dueDate: input.dueDate,
        memo: input.memo,
        allowOnlinePayment: input.allowOnlinePayment ?? true,
      });
      const inv = res.Invoice;
      return {
        externalId: inv.Id,
        status: (inv.Balance ?? 0) === 0 ? "paid" : "sent",
        totalCents: totalFromLines(input.lines),
        balanceCents: Math.round((inv.Balance ?? 0) * 100),
        payLinkUrl: inv.InvoiceLink ?? undefined,
      };
    },

    async getInvoice(externalId): Promise<AccountingInvoice | null> {
      try {
        const client = await getQuickBooksClient(orgId);
        const res = await client.getInvoice(externalId);
        const inv = res.Invoice;
        return {
          externalId: inv.Id,
          status: inv.Balance === 0 ? "paid" : "sent",
          totalCents: 0, // Balance-only info in this endpoint.
          balanceCents: Math.round((inv.Balance ?? 0) * 100),
          payLinkUrl: inv.InvoiceLink ?? undefined,
        };
      } catch (err) {
        console.error("[qbo.provider] getInvoice failed", err);
        return null;
      }
    },

    async reconcilePayments() {
      // TODO(phase-8b): scan CompanyInfo/Payments since a bookmark date.
      // Left as a follow-up — webhook path handles real-time reconciliation.
      return [];
    },
  };
}

function totalFromLines(lines: AccountingLineItem[]): number {
  return lines.reduce((s, l) => s + l.unitPriceCents * l.quantity, 0);
}
