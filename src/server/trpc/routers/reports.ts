import "server-only";

import { z } from "zod";
import { Prisma } from "@prisma/client";

import { createTRPCRouter, orgProcedure, requirePermission } from "../init";

/**
 * Basic operational reports. Uses raw SQL where Prisma's aggregate DSL
 * would be awkward (bucketed time series, ratio queries) — always with
 * an explicit `organizationId` filter because $queryRaw bypasses the
 * db.forOrg extension.
 */
export const reportsRouter = createTRPCRouter({
  summary: orgProcedure
    .use(requirePermission("reports:read"))
    .query(async ({ ctx }) => {
      const orgId = ctx.session.organizationId;
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = startOfMonth;

      const [
        approvedThisMonth,
        approvedLastMonth,
        jobsInProgress,
        openQuotes,
        quotesLast90,
        avgTicketRow,
      ] = await Promise.all([
        ctx.db.quote.aggregate({
          _sum: { totalCents: true },
          where: {
            deletedAt: null,
            status: "approved",
            approvedAt: { gte: startOfMonth },
          },
        }),
        ctx.db.quote.aggregate({
          _sum: { totalCents: true },
          where: {
            deletedAt: null,
            status: "approved",
            approvedAt: { gte: startOfLastMonth, lt: endOfLastMonth },
          },
        }),
        ctx.db.job.count({
          where: {
            deletedAt: null,
            status: {
              in: ["checked_in", "prep", "in_progress", "qc"],
            },
          },
        }),
        ctx.db.quote.count({
          where: { deletedAt: null, status: { in: ["sent", "viewed"] } },
        }),
        ctx.db.quote.findMany({
          where: {
            deletedAt: null,
            createdAt: { gte: new Date(now.getTime() - 90 * 24 * 3600 * 1000) },
          },
          select: { status: true },
        }),
        ctx.db.quote.aggregate({
          _avg: { totalCents: true },
          where: {
            deletedAt: null,
            status: "approved",
            approvedAt: { gte: new Date(now.getTime() - 90 * 24 * 3600 * 1000) },
          },
        }),
      ]);

      const totalQuotesLast90 = quotesLast90.length;
      const approvedLast90 = quotesLast90.filter(
        (q) => q.status === "approved",
      ).length;
      const conversion =
        totalQuotesLast90 > 0 ? approvedLast90 / totalQuotesLast90 : 0;

      return {
        revenueThisMonthCents: approvedThisMonth._sum.totalCents ?? 0,
        revenueLastMonthCents: approvedLastMonth._sum.totalCents ?? 0,
        jobsInProgress,
        openQuotes,
        quoteToCloseRate: conversion,
        avgTicketCents: Math.round(avgTicketRow._avg.totalCents ?? 0),
      };
    }),

  revenueByMonth: orgProcedure
    .use(requirePermission("reports:financial"))
    .input(z.object({ months: z.number().int().min(1).max(24).default(12) }).optional())
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.organizationId;
      const months = input?.months ?? 12;
      const rows = await ctx.db.$queryRaw<Array<{ month: Date; total: bigint }>>(
        Prisma.sql`
          SELECT
            date_trunc('month', "approvedAt") AS month,
            SUM("totalCents")::bigint AS total
          FROM public.quotes
          WHERE "organizationId" = ${orgId}::uuid
            AND "deletedAt" IS NULL
            AND status = 'approved'
            AND "approvedAt" >= date_trunc('month', NOW()) - (${months - 1}::int || ' months')::interval
          GROUP BY month
          ORDER BY month ASC
        `,
      );
      return rows.map((r) => ({
        month: r.month.toISOString().slice(0, 7),
        totalCents: Number(r.total),
      }));
    }),

  serviceMix: orgProcedure
    .use(requirePermission("reports:read"))
    .input(z.object({ days: z.number().int().min(1).max(365).default(90) }).optional())
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.organizationId;
      const days = input?.days ?? 90;
      const rows = await ctx.db.$queryRaw<
        Array<{ description: string; count: bigint; total: bigint }>
      >(
        Prisma.sql`
          SELECT
            li.description,
            COUNT(*)::bigint AS count,
            SUM(li."totalCents")::bigint AS total
          FROM public.quote_line_items li
          JOIN public.quotes q ON q.id = li."quoteId"
          WHERE q."organizationId" = ${orgId}::uuid
            AND q."deletedAt" IS NULL
            AND q.status = 'approved'
            AND q."approvedAt" >= NOW() - (${days}::int || ' days')::interval
            AND li."isUpsell" = FALSE
          GROUP BY li.description
          ORDER BY total DESC
          LIMIT 15
        `,
      );
      return rows.map((r) => ({
        description: r.description,
        count: Number(r.count),
        totalCents: Number(r.total),
      }));
    }),

  techHours: orgProcedure
    .use(requirePermission("reports:read"))
    .input(z.object({ days: z.number().int().min(1).max(365).default(30) }).optional())
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.organizationId;
      const days = input?.days ?? 30;
      const rows = await ctx.db.$queryRaw<
        Array<{ userId: string; name: string | null; email: string | null; minutes: bigint }>
      >(
        Prisma.sql`
          SELECT
            te."userId" AS "userId",
            u.name AS name,
            u.email AS email,
            SUM(
              GREATEST(0,
                EXTRACT(EPOCH FROM (COALESCE(te."clockOut", NOW()) - te."clockIn"))/60
                - te."breakMinutes"
              )
            )::bigint AS minutes
          FROM public.time_entries te
          LEFT JOIN public.users u ON u.id = te."userId"
          WHERE te."organizationId" = ${orgId}::uuid
            AND te."clockIn" >= NOW() - (${days}::int || ' days')::interval
          GROUP BY te."userId", u.name, u.email
          ORDER BY minutes DESC
          LIMIT 25
        `,
      );
      return rows.map((r) => ({
        userId: r.userId,
        name: r.name ?? r.email ?? r.userId,
        hours: Number(r.minutes) / 60,
      }));
    }),

  materialProfitability: orgProcedure
    .use(requirePermission("reports:financial"))
    .input(z.object({ days: z.number().int().min(1).max(365).default(90) }).optional())
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.organizationId;
      const days = input?.days ?? 90;
      const rows = await ctx.db.$queryRaw<
        Array<{ material: string; ydUsed: number; costCents: bigint }>
      >(
        Prisma.sql`
          SELECT
            COALESCE(m.name, '(unknown)') AS material,
            SUM(itx."lengthYd")::float AS "ydUsed",
            SUM(itx."costCents")::bigint AS "costCents"
          FROM public.inventory_transactions itx
          JOIN public.material_rolls r ON r.id = itx."materialRollId"
          LEFT JOIN public.materials m ON m.id = r."materialId"
          WHERE itx."organizationId" = ${orgId}::uuid
            AND itx.kind IN ('deduct', 'waste')
            AND itx."performedAt" >= NOW() - (${days}::int || ' days')::interval
          GROUP BY m.name
          ORDER BY "costCents" DESC
          LIMIT 25
        `,
      );
      return rows.map((r) => ({
        material: r.material,
        ydUsed: Number(r.ydUsed),
        costCents: Number(r.costCents),
      }));
    }),
});
