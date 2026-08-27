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
});
