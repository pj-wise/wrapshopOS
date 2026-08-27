import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createInvoiceFromJobInput,
  voidInvoiceInput,
} from "@/lib/schemas/billing";
import {
  createTRPCRouter,
  orgProcedure,
  requirePermission,
} from "../init";
import { inngest } from "@/server/jobs/client";
import { recordTimelineEvent } from "@/server/audit/timeline";
import { isAccountingConnected } from "@/server/providers/registry";

export const invoicesRouter = createTRPCRouter({
  list: orgProcedure
    .use(requirePermission("invoices:read"))
    .input(
      z
        .object({
          status: z.string().optional(),
          customerId: z.string().uuid().optional(),
          limit: z.number().int().min(1).max(100).default(50),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const items = await ctx.db.invoice.findMany({
        where: {
          deletedAt: null,
          status: input?.status ?? undefined,
          customerId: input?.customerId ?? undefined,
        },
        include: {
          customer: { select: { id: true, name: true, email: true } },
          job: { select: { id: true, number: true } },
        },
        orderBy: { createdAt: "desc" },
        take: input?.limit ?? 50,
      });
      return { items };
    }),

  get: orgProcedure
    .use(requirePermission("invoices:read"))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const inv = await ctx.db.invoice.findFirst({
        where: { id: input.id, deletedAt: null },
        include: {
          customer: true,
          job: { select: { id: true, number: true, title: true } },
          items: { orderBy: { sortOrder: "asc" } },
          payments: { orderBy: { receivedAt: "desc" } },
        },
      });
      if (!inv) throw new TRPCError({ code: "NOT_FOUND" });
      return inv;
    }),

  /**
   * Materialize an Invoice from a Job's linked Quote (or the Job itself when
   * there's no quote). Idempotent per jobId — returns the existing invoice
   * instead of creating a duplicate.
   */
  createFromJob: orgProcedure
    .use(requirePermission("invoices:write"))
    .meta({ audit: { entity: "invoice", action: "create" } })
    .input(createInvoiceFromJobInput)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.invoice.findFirst({
        where: { jobId: input.jobId, deletedAt: null },
      });
      if (existing) return existing;

      const job = await ctx.db.job.findFirst({
        where: { id: input.jobId, deletedAt: null },
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
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });

      const lines = (job.quote?.items ?? []).map((li, i) => ({
        organizationId: ctx.session.organizationId,
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

      const last = await ctx.db.invoice.findFirst({
        orderBy: { number: "desc" },
        select: { number: true },
      });
      const number = (last?.number ?? 0) + 1;

      const invoice = await ctx.db.invoice.create({
        data: {
          organizationId: ctx.session.organizationId,
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
          dueDate: input.dueDate ?? null,
          memo: input.memo ?? null,
          createdByUserId: ctx.session.userId,
          items: { createMany: { data: lines } },
        },
      });

      await recordTimelineEvent(ctx.session.organizationId, {
        entityType: "customer",
        entityId: job.customerId,
        kind: "invoice.created",
        actorUserId: ctx.session.userId,
        data: { invoiceId: invoice.id, invoiceNumber: invoice.number, totalCents },
      });

      if (input.autoSyncToQbo && (await isAccountingConnected(ctx.session.organizationId))) {
        await inngest.send({
          name: "qbo.sync.invoice",
          data: {
            orgId: ctx.session.organizationId,
            invoiceId: invoice.id,
          },
        });
        await ctx.db.invoice.update({
          where: { id: invoice.id },
          data: { qboSyncStatus: "syncing" },
        });
      }

      return invoice;
    }),

  markSent: orgProcedure
    .use(requirePermission("invoices:write"))
    .meta({ audit: { entity: "invoice", action: "mark_sent" } })
    .input(z.object({ id: z.string().uuid() }))
    .mutation(({ ctx, input }) =>
      ctx.db.invoice.update({
        where: { id: input.id },
        data: { status: "sent", sentAt: new Date() },
      }),
    ),

  void: orgProcedure
    .use(requirePermission("invoices:void"))
    .meta({ audit: { entity: "invoice", action: "void" } })
    .input(voidInvoiceInput)
    .mutation(({ ctx, input }) =>
      ctx.db.invoice.update({
        where: { id: input.id },
        data: {
          status: "void",
          voidedAt: new Date(),
          memo: input.reason ? `VOID: ${input.reason}` : undefined,
        },
      }),
    ),

  /**
   * Manually re-enqueue a QBO sync for this invoice. Used to retry after
   * an error or if the invoice was created before QBO was connected.
   */
  resyncToQbo: orgProcedure
    .use(requirePermission("invoices:write"))
    .meta({ audit: { entity: "invoice", action: "resync_qbo" } })
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!(await isAccountingConnected(ctx.session.organizationId))) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "QuickBooks is not connected.",
        });
      }
      await inngest.send({
        name: "qbo.sync.invoice",
        data: { orgId: ctx.session.organizationId, invoiceId: input.id },
      });
      await ctx.db.invoice.update({
        where: { id: input.id },
        data: { qboSyncStatus: "syncing", qboSyncError: null },
      });
      return { ok: true };
    }),
});
