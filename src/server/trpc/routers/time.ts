import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { clockInInput, clockOutInput } from "@/lib/schemas/production";
import {
  createTRPCRouter,
  orgProcedure,
  requirePermission,
} from "../init";

/**
 * Time tracking — clock-in/out per user, optionally attached to a job.
 * `openEntry` returns the user's currently-open entry (clockOut null) if any.
 */
export const timeRouter = createTRPCRouter({
  openEntry: orgProcedure.query(({ ctx }) =>
    ctx.db.timeEntry.findFirst({
      where: { userId: ctx.session.userId, clockOut: null },
      orderBy: { clockIn: "desc" },
      include: { job: { select: { id: true, number: true, title: true } } },
    }),
  ),

  listForJob: orgProcedure
    .use(requirePermission("jobs:read"))
    .input(z.object({ jobId: z.string().uuid() }))
    .query(({ ctx, input }) =>
      ctx.db.timeEntry.findMany({
        where: { jobId: input.jobId },
        orderBy: { clockIn: "desc" },
        take: 100,
      }),
    ),

  clockIn: orgProcedure
    .meta({ audit: { entity: "time_entry", action: "clock_in" } })
    .input(clockInInput)
    .mutation(async ({ ctx, input }) => {
      const open = await ctx.db.timeEntry.findFirst({
        where: { userId: ctx.session.userId, clockOut: null },
      });
      if (open) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "You already have an open time entry — clock out first.",
        });
      }
      return ctx.db.timeEntry.create({
        data: {
          organizationId: ctx.session.organizationId,
          userId: ctx.session.userId,
          jobId: input.jobId ?? null,
          clockIn: new Date(),
          notes: input.notes ?? null,
          source: "clock",
        },
      });
    }),

  clockOut: orgProcedure
    .meta({ audit: { entity: "time_entry", action: "clock_out" } })
    .input(clockOutInput)
    .mutation(async ({ ctx, input }) => {
      const entry = await ctx.db.timeEntry.findFirst({
        where: { id: input.id, userId: ctx.session.userId, clockOut: null },
      });
      if (!entry) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No open entry with that id." });
      }
      return ctx.db.timeEntry.update({
        where: { id: entry.id },
        data: {
          clockOut: new Date(),
          breakMinutes: input.breakMinutes,
          notes: input.notes ?? entry.notes,
        },
      });
    }),
});
