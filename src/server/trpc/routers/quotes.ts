import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createQuoteInput,
  priceLinePreviewInput,
  sendQuoteInput,
  updateQuoteInput,
} from "@/lib/schemas/quotes";
import {
  createTRPCRouter,
  orgProcedure,
  requirePermission,
} from "../init";
import { computeQuoteTotals, priceLine, type ServiceForPricing } from "@/server/services/pricing";
import { recordTimelineEvent } from "@/server/audit/timeline";
import { inngest } from "@/server/jobs/client";
import { materializeJobFromQuote } from "@/server/services/materialize-job-from-quote";

/**
 * Generate an opaque URL-safe portal token for magic-link access.
 * Uses Node's `crypto.randomBytes` via web crypto (available in Node 20+).
 */
function generatePortalToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

/**
 * Compute all totals for a quote given its line items (already priced) plus
 * order-level knobs. Wrapped so we don't re-implement in every mutation.
 */
function totalsFor(
  items: Array<{
    subtotalCents: number;
    discountCents: number;
    totalCents: number;
    taxable: boolean;
  }>,
  quote: {
    taxRateBps: number;
    depositCents: number;
    depositPercent: number;
  },
) {
  return computeQuoteTotals({
    lines: items,
    taxRateBps: quote.taxRateBps,
    depositCents: quote.depositCents,
    depositPercent: quote.depositPercent,
  });
}

function toServiceForPricing(svc: {
  id: string;
  name: string;
  pricingModel: string;
  priceCents: number;
  laborCostCents: number | null;
  productOnly: boolean;
  hourlyRateCents: number | null;
  estimatedHours: unknown;
  defaultCoverageSqft: unknown;
  matrixJson: unknown;
  taxable: boolean;
}): ServiceForPricing {
  return {
    id: svc.id,
    name: svc.name,
    pricingModel: svc.pricingModel as ServiceForPricing["pricingModel"],
    priceCents: svc.priceCents,
    laborCostCents: svc.laborCostCents,
    productOnly: svc.productOnly,
    hourlyRateCents: svc.hourlyRateCents,
    estimatedHours: svc.estimatedHours ? Number(svc.estimatedHours) : null,
    defaultCoverageSqft: svc.defaultCoverageSqft ? Number(svc.defaultCoverageSqft) : null,
    matrixJson: svc.matrixJson,
    taxable: svc.taxable,
  };
}

export const quotesRouter = createTRPCRouter({
  // -------- Listing --------
  list: orgProcedure
    .use(requirePermission("quotes:read"))
    .input(
      z
        .object({
          cursor: z.string().uuid().optional(),
          limit: z.number().int().min(1).max(100).default(50),
          status: z.string().optional(),
          customerId: z.string().uuid().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 50;
      const rows = await ctx.db.quote.findMany({
        take: limit + 1,
        cursor: input?.cursor ? { id: input.cursor } : undefined,
        orderBy: { createdAt: "desc" },
        where: {
          deletedAt: null,
          status: input?.status ?? undefined,
          customerId: input?.customerId ?? undefined,
        },
        include: {
          customer: { select: { id: true, name: true } },
        },
      });
      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, -1) : rows;
      return { items, nextCursor: hasMore ? items.at(-1)?.id ?? null : null };
    }),

  get: orgProcedure
    .use(requirePermission("quotes:read"))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const q = await ctx.db.quote.findFirst({
        where: { id: input.id, deletedAt: null },
        include: {
          items: { orderBy: { sortOrder: "asc" } },
          customer: true,
          views: { orderBy: { viewedAt: "desc" }, take: 20 },
        },
      });
      if (!q) throw new TRPCError({ code: "NOT_FOUND" });
      return q;
    }),

  priceLine: orgProcedure
    .use(requirePermission("quotes:read"))
    .input(priceLinePreviewInput)
    .query(async ({ ctx, input }) => {
      const svc = await ctx.db.service.findFirst({
        where: { id: input.serviceId, deletedAt: null },
      });
      if (!svc) throw new TRPCError({ code: "NOT_FOUND" });
      return priceLine(toServiceForPricing(svc), {
        quantity: input.quantity,
        coverageSqft: input.coverageSqft,
        hours: input.hours,
        vehicleSize: input.vehicleSize,
        variableOptionKey: input.variableOptionKey,
        discountPercent: input.discountPercent,
        discountCents: input.discountCents,
      });
    }),

  create: orgProcedure
    .use(requirePermission("quotes:write"))
    .meta({ audit: { entity: "quote", action: "create" } })
    .input(createQuoteInput)
    .mutation(async ({ ctx, input }) => {
      // Assign next quote number for the org.
      const last = await ctx.db.quote.findFirst({
        orderBy: { number: "desc" },
        select: { number: true },
      });
      const number = (last?.number ?? 0) + 1;

      const linesWithTotals = input.items.map((line, i) => {
        const subtotal = Math.round(line.unitPriceCents * (line.quantity || 1));
        const total = Math.max(0, subtotal - line.discountCents);
        return {
          sortOrder: i,
          serviceId: line.serviceId ?? null,
          materialId: line.materialId ?? null,
          description: line.description,
          quantity: line.quantity,
          unit: line.unit,
          unitPriceCents: line.unitPriceCents,
          discountCents: line.discountCents,
          totalCents: total,
          taxable: line.taxable,
          isUpsell: line.isUpsell,
          notes: line.notes ?? null,
          subtotalCents: subtotal,
        };
      });

      const nonUpsell = linesWithTotals.filter((l) => !l.isUpsell);
      const totals = totalsFor(nonUpsell, {
        taxRateBps: input.taxRateBps,
        depositCents: input.depositCents,
        depositPercent: input.depositPercent,
      });

      const quote = await ctx.db.quote.create({
        data: {
          organizationId: ctx.session.organizationId,
          customerId: input.customerId,
          vehicleId: input.vehicleId ?? null,
          number,
          portalToken: generatePortalToken(),
          currency: input.currency,
          taxRateBps: input.taxRateBps,
          depositCents: input.depositCents,
          depositPercent: input.depositPercent,
          terms: input.terms ?? null,
          customerNotes: input.customerNotes ?? null,
          internalNotes: input.internalNotes ?? null,
          expiresAt: input.expiresAt ?? null,
          subtotalCents: totals.subtotalCents,
          discountCents: totals.lineDiscountCents + totals.orderDiscountCents,
          taxCents: totals.taxCents,
          totalCents: totals.totalCents,
          createdByUserId: ctx.session.userId,
          items: {
            create: linesWithTotals.map((l) => ({
              organizationId: ctx.session.organizationId,
              serviceId: l.serviceId,
              materialId: l.materialId,
              sortOrder: l.sortOrder,
              description: l.description,
              quantity: l.quantity,
              unit: l.unit,
              unitPriceCents: l.unitPriceCents,
              discountCents: l.discountCents,
              totalCents: l.totalCents,
              taxable: l.taxable,
              isUpsell: l.isUpsell,
              notes: l.notes,
            })),
          },
        },
      });

      await recordTimelineEvent(ctx.session.organizationId, {
        entityType: "customer",
        entityId: input.customerId,
        kind: "quote.created",
        actorUserId: ctx.session.userId,
        data: { quoteId: quote.id, number: quote.number, totalCents: quote.totalCents },
      });

      return quote;
    }),

  update: orgProcedure
    .use(requirePermission("quotes:write"))
    .meta({ audit: { entity: "quote", action: "update" } })
    .input(updateQuoteInput)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.quote.findFirst({
        where: { id: input.id, deletedAt: null },
        include: { items: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      // Approved quotes ARE editable — the UI offers a "Request new approval"
      // toggle for the case where the shop wants a fresh signature. Silent
      // in-place edits are intentional here (typo fix, note tweak, etc.).

      const linesInput = input.items ?? existing.items.map((i) => ({
        id: i.id,
        serviceId: i.serviceId,
        materialId: i.materialId,
        description: i.description,
        quantity: Number(i.quantity),
        unit: i.unit as "each" | "sqft" | "linear_ft" | "hour",
        unitPriceCents: i.unitPriceCents,
        discountCents: i.discountCents,
        taxable: i.taxable,
        isUpsell: i.isUpsell,
        notes: i.notes ?? undefined,
      }));

      const linesWithTotals = linesInput.map((line, i) => {
        const subtotal = Math.round(line.unitPriceCents * (line.quantity || 1));
        const total = Math.max(0, subtotal - line.discountCents);
        return { ...line, sortOrder: i, subtotalCents: subtotal, totalCents: total };
      });

      const nonUpsell = linesWithTotals.filter((l) => !l.isUpsell);
      const totals = totalsFor(nonUpsell, {
        taxRateBps: input.taxRateBps ?? existing.taxRateBps,
        depositCents: input.depositCents ?? existing.depositCents,
        depositPercent: input.depositPercent ?? existing.depositPercent,
      });

      return await ctx.db.$transaction(async (tx) => {
        // Replace all line items (simplest correct approach for MVP).
        await tx.quoteLineItem.deleteMany({ where: { quoteId: input.id } });
        await tx.quoteLineItem.createMany({
          data: linesWithTotals.map((l) => ({
            quoteId: input.id,
            organizationId: ctx.session.organizationId,
            serviceId: l.serviceId ?? null,
            materialId: l.materialId ?? null,
            sortOrder: l.sortOrder,
            description: l.description,
            quantity: l.quantity,
            unit: l.unit,
            unitPriceCents: l.unitPriceCents,
            discountCents: l.discountCents,
            totalCents: l.totalCents,
            taxable: l.taxable,
            isUpsell: l.isUpsell,
            notes: l.notes ?? null,
          })),
        });
        return tx.quote.update({
          where: { id: input.id },
          data: {
            customerId: input.customerId ?? undefined,
            vehicleId: input.vehicleId === undefined ? undefined : input.vehicleId,
            currency: input.currency ?? undefined,
            taxRateBps: input.taxRateBps ?? undefined,
            depositCents: input.depositCents ?? undefined,
            depositPercent: input.depositPercent ?? undefined,
            terms: input.terms ?? undefined,
            customerNotes: input.customerNotes ?? undefined,
            internalNotes: input.internalNotes ?? undefined,
            expiresAt: input.expiresAt === undefined ? undefined : input.expiresAt,
            subtotalCents: totals.subtotalCents,
            discountCents: totals.lineDiscountCents + totals.orderDiscountCents,
            taxCents: totals.taxCents,
            totalCents: totals.totalCents,
          },
        });
      });
    }),

  send: orgProcedure
    .use(requirePermission("quotes:send"))
    .meta({ audit: { entity: "quote", action: "send" } })
    .input(sendQuoteInput)
    .mutation(async ({ ctx, input }) => {
      const quote = await ctx.db.quote.findFirst({
        where: { id: input.id, deletedAt: null },
        include: { customer: true },
      });
      if (!quote) throw new TRPCError({ code: "NOT_FOUND" });
      if (!quote.customer.email) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Customer has no email — add one before sending the quote.",
        });
      }
      const updated = await ctx.db.quote.update({
        where: { id: quote.id },
        data: {
          status: "sent",
          sentAt: quote.sentAt ?? new Date(),
        },
      });

      // Fire email + PDF renders as background jobs. Idempotent by quote id.
      await inngest.send({
        name: "quote.approved",
        data: {
          orgId: ctx.session.organizationId,
          quoteId: quote.id,
          customerId: quote.customerId,
        },
      });

      await recordTimelineEvent(ctx.session.organizationId, {
        entityType: "quote" as never,
        entityId: quote.id,
        kind: "quote.sent",
        actorUserId: ctx.session.userId,
        data: { to: quote.customer.email },
      });
      await recordTimelineEvent(ctx.session.organizationId, {
        entityType: "customer",
        entityId: quote.customerId,
        kind: "quote.sent",
        actorUserId: ctx.session.userId,
        data: { quoteId: quote.id, number: quote.number },
      });

      return updated;
    }),

  duplicate: orgProcedure
    .use(requirePermission("quotes:write"))
    .meta({ audit: { entity: "quote", action: "duplicate" } })
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const src = await ctx.db.quote.findFirst({
        where: { id: input.id, deletedAt: null },
        include: { items: true },
      });
      if (!src) throw new TRPCError({ code: "NOT_FOUND" });

      const last = await ctx.db.quote.findFirst({
        orderBy: { number: "desc" },
        select: { number: true },
      });
      const number = (last?.number ?? 0) + 1;

      return ctx.db.quote.create({
        data: {
          organizationId: ctx.session.organizationId,
          customerId: src.customerId,
          vehicleId: src.vehicleId,
          number,
          portalToken: generatePortalToken(),
          currency: src.currency,
          taxRateBps: src.taxRateBps,
          depositCents: src.depositCents,
          depositPercent: src.depositPercent,
          terms: src.terms,
          customerNotes: src.customerNotes,
          internalNotes: src.internalNotes,
          subtotalCents: src.subtotalCents,
          discountCents: src.discountCents,
          taxCents: src.taxCents,
          totalCents: src.totalCents,
          createdByUserId: ctx.session.userId,
          items: {
            create: src.items.map((i) => ({
              organizationId: ctx.session.organizationId,
              serviceId: i.serviceId,
              materialId: i.materialId,
              sortOrder: i.sortOrder,
              description: i.description,
              quantity: i.quantity,
              unit: i.unit,
              unitPriceCents: i.unitPriceCents,
              discountCents: i.discountCents,
              totalCents: i.totalCents,
              taxable: i.taxable,
              isUpsell: i.isUpsell,
              notes: i.notes,
            })),
          },
        },
      });
    }),

  void: orgProcedure
    .use(requirePermission("quotes:write"))
    .meta({ audit: { entity: "quote", action: "void" } })
    .input(z.object({ id: z.string().uuid() }))
    .mutation(({ ctx, input }) =>
      ctx.db.quote.update({
        where: { id: input.id },
        data: { status: "revoked" },
      }),
    ),

  /**
   * One-shot backfill: for every approved quote in the org that never
   * materialized into a Job (because the Inngest event was dropped in
   * dev, or historical rows predate the materialization flow), create
   * the Job now via the shared idempotent helper.
   *
   * Returns per-quote outcomes so the caller can toast something useful.
   * Safe to call repeatedly — quotes with existing Jobs are skipped.
   */
  backfillApprovedJobs: orgProcedure
    .use(requirePermission("quotes:write"))
    .meta({ audit: { entity: "quote", action: "backfill_jobs" } })
    .mutation(async ({ ctx }) => {
      // Fetch every approved-or-later quote and left-anti-join against jobs
      // in-memory (cheaper than a raw NOT EXISTS for the tiny data volume
      // we expect a shop to have during backfill).
      const [quotes, jobs] = await Promise.all([
        ctx.db.quote.findMany({
          where: {
            deletedAt: null,
            status: { in: ["approved"] },
          },
          select: { id: true },
        }),
        ctx.db.job.findMany({
          where: { deletedAt: null, quoteId: { not: null } },
          select: { quoteId: true },
        }),
      ]);
      const jobbedQuoteIds = new Set(jobs.map((j) => j.quoteId!));
      const orphans = quotes.filter((q) => !jobbedQuoteIds.has(q.id));

      let created = 0;
      const failures: Array<{ quoteId: string; message: string }> = [];
      for (const q of orphans) {
        try {
          const res = await materializeJobFromQuote(ctx.session.organizationId, q.id);
          if (res.created) created++;
        } catch (err) {
          failures.push({
            quoteId: q.id,
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }

      // Repair pass: earlier revisions of the materializer skipped straight
      // to "ready" (Deposit received) for quotes with no configured
      // deposit — misleading for a job the shop hasn't touched yet. Reset
      // any unscheduled, quote-linked `ready` job back to `approved`.
      // Scheduled or manually-progressed jobs are left alone.
      const repair = await ctx.db.job.updateMany({
        where: {
          deletedAt: null,
          status: "ready",
          scheduledStart: null,
          quoteId: { not: null },
        },
        data: { status: "approved" },
      });

      return {
        scanned: quotes.length,
        candidates: orphans.length,
        created,
        repaired: repair.count,
        failures,
      };
    }),
});
