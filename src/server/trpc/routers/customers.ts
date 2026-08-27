import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createCustomerInput,
  updateCustomerInput,
} from "@/lib/schemas/crm";
import {
  createTRPCRouter,
  orgProcedure,
  requirePermission,
} from "../init";
import { recordTimelineEvent } from "@/server/audit/timeline";

export const customersRouter = createTRPCRouter({
  list: orgProcedure
    .use(requirePermission("crm:read"))
    .input(
      z
        .object({
          cursor: z.string().uuid().optional(),
          limit: z.number().int().min(1).max(100).default(50),
          q: z.string().trim().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 50;
      const cursor = input?.cursor;
      const q = input?.q?.toLowerCase();

      const rows = await ctx.db.customer.findMany({
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { createdAt: "desc" },
        where: {
          deletedAt: null,
          ...(q
            ? {
                OR: [
                  { name: { contains: q, mode: "insensitive" } },
                  { businessName: { contains: q, mode: "insensitive" } },
                  { email: { contains: q, mode: "insensitive" } },
                  { phone: { contains: q } },
                ],
              }
            : {}),
        },
        include: {
          _count: { select: { vehicles: true } },
        },
      });
      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, -1) : rows;
      return { items, nextCursor: hasMore ? items.at(-1)?.id ?? null : null };
    }),

  get: orgProcedure
    .use(requirePermission("crm:read"))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const customer = await ctx.db.customer.findFirst({
        where: { id: input.id, deletedAt: null },
        include: {
          vehicles: {
            where: { deletedAt: null },
            orderBy: { createdAt: "desc" },
          },
        },
      });
      if (!customer) throw new TRPCError({ code: "NOT_FOUND" });
      return customer;
    }),

  create: orgProcedure
    .use(requirePermission("crm:write"))
    .meta({ audit: { entity: "customer", action: "create" } })
    .input(createCustomerInput)
    .mutation(async ({ ctx, input }) => {
      const customer = await ctx.db.customer.create({
        data: { ...input, organizationId: ctx.session.organizationId },
      });
      await recordTimelineEvent(ctx.session.organizationId, {
        entityType: "customer",
        entityId: customer.id,
        kind: "customer.created",
        actorUserId: ctx.session.userId,
        data: { name: customer.name },
      });
      return customer;
    }),

  update: orgProcedure
    .use(requirePermission("crm:write"))
    .meta({ audit: { entity: "customer", action: "update" } })
    .input(updateCustomerInput)
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      const customer = await ctx.db.customer.update({
        where: { id },
        data: rest,
      });
      await recordTimelineEvent(ctx.session.organizationId, {
        entityType: "customer",
        entityId: customer.id,
        kind: "customer.updated",
        actorUserId: ctx.session.userId,
        data: { changedFields: Object.keys(rest) },
      });
      return customer;
    }),

  softDelete: orgProcedure
    .use(requirePermission("crm:delete"))
    .meta({ audit: { entity: "customer", action: "delete" } })
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.customer.update({
        where: { id: input.id },
        data: { deletedAt: new Date() },
      });
      await recordTimelineEvent(ctx.session.organizationId, {
        entityType: "customer",
        entityId: input.id,
        kind: "customer.deleted",
        actorUserId: ctx.session.userId,
        data: {},
      });
      return { ok: true };
    }),

  timeline: orgProcedure
    .use(requirePermission("crm:read"))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const events = await ctx.db.timelineEvent.findMany({
        where: { entityType: "customer", entityId: input.id },
        orderBy: { occurredAt: "desc" },
        take: 100,
        include: { actor: { select: { name: true, email: true } } },
      });
      return events;
    }),
});
