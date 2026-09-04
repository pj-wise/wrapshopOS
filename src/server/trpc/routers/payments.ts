import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { recordPaymentInput } from "@/lib/schemas/billing";
import {
  createTRPCRouter,
  orgProcedure,
  requirePermission,
} from "../init";
import { recordTimelineEvent } from "@/server/audit/timeline";
import { getPaymentProvider } from "@/server/providers/registry";
import { env } from "@/env";

export const paymentsRouter = createTRPCRouter({
  list: orgProcedure
    .use(requirePermission("payments:read"))
    .input(
      z
        .object({
          invoiceId: z.string().uuid().optional(),
          customerId: z.string().uuid().optional(),
          unmatchedOnly: z.boolean().default(false),
        })
        .optional(),
    )
    .query(({ ctx, input }) =>
      ctx.db.payment.findMany({
        where: {
          invoiceId: input?.invoiceId ?? undefined,
          customerId: input?.customerId ?? undefined,
          ...(input?.unmatchedOnly ? { invoiceId: null } : {}),
        },
        include: {
          invoice: { select: { id: true, number: true, totalCents: true } },
          customer: { select: { id: true, name: true } },
        },
        orderBy: { receivedAt: "desc" },
        take: 100,
      }),
    ),

  record: orgProcedure
    .use(requirePermission("payments:record"))
    .meta({ audit: { entity: "payment", action: "record" } })
    .input(recordPaymentInput)
    .mutation(async ({ ctx, input }) => {
      const payment = await ctx.db.$transaction(async (tx) => {
        const p = await tx.payment.create({
          data: {
            organizationId: ctx.session.organizationId,
            invoiceId: input.invoiceId ?? null,
            customerId: input.customerId ?? null,
            amountCents: input.amountCents,
            method: input.method,
            referenceNumber: input.referenceNumber ?? null,
            notes: input.notes ?? null,
            receivedAt: input.receivedAt ?? new Date(),
            recordedByUserId: ctx.session.userId,
          },
        });
        if (input.invoiceId) {
          const inv = await tx.invoice.findFirst({
            where: { id: input.invoiceId },
          });
          if (inv) {
            const paid = inv.amountPaidCents + input.amountCents;
            const balance = Math.max(0, inv.totalCents - paid);
            const nextStatus =
              balance === 0 ? "paid" : paid > 0 ? "partial" : inv.status;
            await tx.invoice.update({
              where: { id: inv.id },
              data: {
                amountPaidCents: paid,
                balanceCents: balance,
                status: nextStatus,
                paidAt: balance === 0 ? new Date() : null,
              },
            });

            // If the invoice traces to a quote with an outstanding deposit
            // ask, and running paid ≥ deposit amount, mark the Deposit paid.
            // Keeps the "Deposit received" affordance in sync when the shop
            // records the first partial payment inline.
            if (inv.quoteId) {
              const dep = await tx.deposit.findFirst({
                where: {
                  organizationId: ctx.session.organizationId,
                  quoteId: inv.quoteId,
                  status: "requested",
                },
              });
              if (dep && paid >= dep.amountCents) {
                await tx.deposit.update({
                  where: { id: dep.id },
                  data: { status: "paid", paidAt: new Date() },
                });
              }
            }
          }
        }
        return p;
      });

      if (input.invoiceId) {
        const inv = await ctx.db.invoice.findFirst({
          where: { id: input.invoiceId },
          select: { customerId: true, number: true },
        });
        if (inv) {
          await recordTimelineEvent(ctx.session.organizationId, {
            entityType: "customer",
            entityId: inv.customerId,
            kind: "payment.received",
            actorUserId: ctx.session.userId,
            data: {
              invoiceId: input.invoiceId,
              invoiceNumber: inv.number,
              amountCents: input.amountCents,
              method: input.method,
            },
          });
        }
      }

      return payment;
    }),

  reconcileToInvoice: orgProcedure
    .use(requirePermission("payments:record"))
    .meta({ audit: { entity: "payment", action: "reconcile" } })
    .input(
      z.object({ paymentId: z.string().uuid(), invoiceId: z.string().uuid() }),
    )
    .mutation(async ({ ctx, input }) => {
      const payment = await ctx.db.payment.findFirst({
        where: { id: input.paymentId },
      });
      if (!payment) throw new TRPCError({ code: "NOT_FOUND" });
      if (payment.invoiceId) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Payment is already matched.",
        });
      }
      return await ctx.db.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: { invoiceId: input.invoiceId },
        });
        const inv = await tx.invoice.findFirst({
          where: { id: input.invoiceId },
        });
        if (!inv) throw new TRPCError({ code: "NOT_FOUND" });
        const paid = inv.amountPaidCents + payment.amountCents;
        const balance = Math.max(0, inv.totalCents - paid);
        return tx.invoice.update({
          where: { id: inv.id },
          data: {
            amountPaidCents: paid,
            balanceCents: balance,
            status: balance === 0 ? "paid" : paid > 0 ? "partial" : inv.status,
            paidAt: balance === 0 ? new Date() : null,
          },
        });
      });
    }),

  /**
   * Is a payment provider (Stripe) configured for this org? Powers the
   * "Collect with Stripe" affordance on invoice detail pages.
   */
  providerStatus: orgProcedure
    .use(requirePermission("payments:read"))
    .query(async ({ ctx }) => {
      const provider = await getPaymentProvider(ctx.session.organizationId);
      return {
        connected: provider !== null,
        provider: provider?.name ?? null,
      };
    }),

  /**
   * Create a Stripe Checkout session for the invoice's outstanding balance.
   * Returns the hosted URL — the shop's UI redirects the customer to it
   * (or texts/emails it via the invoice email).
   */
  createStripeCheckout: orgProcedure
    .use(requirePermission("payments:record"))
    .meta({ audit: { entity: "invoice", action: "stripe_checkout" } })
    .input(
      z.object({
        invoiceId: z.string().uuid(),
        /** Override amount (partial charge). Defaults to full remaining balance. */
        amountCents: z.number().int().min(50).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const provider = await getPaymentProvider(ctx.session.organizationId);
      if (!provider) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Stripe is not connected. Configure it in Admin → Integrations.",
        });
      }

      const invoice = await ctx.db.invoice.findFirst({
        where: { id: input.invoiceId, deletedAt: null },
        include: { customer: { select: { name: true, email: true } } },
      });
      if (!invoice) throw new TRPCError({ code: "NOT_FOUND" });
      if (invoice.balanceCents <= 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Invoice has no outstanding balance.",
        });
      }

      const amount = input.amountCents ?? invoice.balanceCents;
      const invoiceLabel = `INV-${String(invoice.number).padStart(4, "0")}`;

      const session = await provider.createCheckoutSession({
        invoiceId: invoice.id,
        amountCents: amount,
        currency: invoice.currency,
        customerEmail: invoice.customer.email ?? undefined,
        description: `${invoiceLabel} — ${invoice.customer.name}`,
        successUrl: `${env.NEXT_PUBLIC_APP_URL}/invoices/${invoice.id}?paid=1`,
        cancelUrl: `${env.NEXT_PUBLIC_APP_URL}/invoices/${invoice.id}`,
      });

      // Stash the URL + session id on the invoice for retrieval by email
      // renderers, "Copy pay link" buttons, etc.
      await ctx.db.invoice.update({
        where: { id: invoice.id },
        data: {
          stripeCheckoutUrl: session.url,
          stripeCheckoutSessionId: session.externalId,
        },
      });

      return {
        url: session.url,
        sessionId: session.externalId,
        amountCents: amount,
        expiresAt: session.expiresAt,
      };
    }),
});
