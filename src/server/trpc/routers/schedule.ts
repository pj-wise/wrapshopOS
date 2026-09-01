import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createScheduleBlockInput,
  updateScheduleBlockInput,
} from "@/lib/schemas/production";
import {
  createTRPCRouter,
  orgProcedure,
  requirePermission,
} from "../init";

/**
 * Schedule router — day / week views + conflict detection at write time.
 * Also handles the tech-availability + holiday tables (edited via admin UI in
 * a later phase; scheduler just reads them for capacity hints).
 */
export const scheduleRouter = createTRPCRouter({
  list: orgProcedure
    .use(requirePermission("scheduling:read"))
    .input(
      z.object({
        rangeStart: z.coerce.date(),
        rangeEnd: z.coerce.date(),
        bayId: z.string().uuid().optional(),
        techUserId: z.string().uuid().optional(),
      }),
    )
    .query(({ ctx, input }) =>
      ctx.db.scheduleBlock.findMany({
        where: {
          bayId: input.bayId ?? undefined,
          techUserId: input.techUserId ?? undefined,
          OR: [
            { start: { gte: input.rangeStart, lt: input.rangeEnd } },
            { end: { gt: input.rangeStart, lte: input.rangeEnd } },
            {
              AND: [
                { start: { lte: input.rangeStart } },
                { end: { gte: input.rangeEnd } },
              ],
            },
          ],
        },
        include: {
          job: {
            select: {
              id: true,
              number: true,
              title: true,
              status: true,
              customer: { select: { name: true } },
              vehicle: { select: { year: true, make: true, model: true } },
              quote: {
                select: {
                  items: {
                    orderBy: { sortOrder: "asc" },
                    select: {
                      description: true,
                      isUpsell: true,
                      upsellAccepted: true,
                      sortOrder: true,
                    },
                  },
                },
              },
            },
          },
          bay: { select: { id: true, name: true } },
        },
        orderBy: { start: "asc" },
      }),
    ),

  /**
   * Detect conflicts for a given (bay, tech, start, end) window. Excludes
   * the block being edited (via `excludeBlockId`) so an update doesn't flag
   * itself. Returns the conflicting blocks so the UI can render them.
   */
  detectConflicts: orgProcedure
    .use(requirePermission("scheduling:read"))
    .input(
      z.object({
        start: z.coerce.date(),
        end: z.coerce.date(),
        bayId: z.string().uuid().nullable().optional(),
        techUserId: z.string().uuid().nullable().optional(),
        excludeBlockId: z.string().uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!input.bayId && !input.techUserId) {
        return { conflicts: [] };
      }
      const conflicts = await ctx.db.scheduleBlock.findMany({
        where: {
          id: input.excludeBlockId ? { not: input.excludeBlockId } : undefined,
          OR: [
            input.bayId ? { bayId: input.bayId } : undefined,
            input.techUserId ? { techUserId: input.techUserId } : undefined,
          ].filter(Boolean) as never,
          AND: [
            { start: { lt: input.end } },
            { end: { gt: input.start } },
          ],
        },
        include: {
          bay: { select: { name: true } },
          job: { select: { number: true } },
        },
      });
      return { conflicts };
    }),

  create: orgProcedure
    .use(requirePermission("scheduling:write"))
    .meta({ audit: { entity: "schedule_block", action: "create" } })
    .input(createScheduleBlockInput)
    .mutation(async ({ ctx, input }) => {
      if (input.end <= input.start) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "End must be after start." });
      }
      return ctx.db.scheduleBlock.create({
        data: {
          ...input,
          organizationId: ctx.session.organizationId,
          createdByUserId: ctx.session.userId,
        },
      });
    }),

  update: orgProcedure
    .use(requirePermission("scheduling:write"))
    .meta({ audit: { entity: "schedule_block", action: "update" } })
    .input(updateScheduleBlockInput)
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      if (rest.start && rest.end && rest.end <= rest.start) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "End must be after start." });
      }
      return ctx.db.scheduleBlock.update({ where: { id }, data: rest });
    }),

  delete: orgProcedure
    .use(requirePermission("scheduling:write"))
    .meta({ audit: { entity: "schedule_block", action: "delete" } })
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.scheduleBlock.delete({ where: { id: input.id } });
      return { ok: true };
    }),
});
