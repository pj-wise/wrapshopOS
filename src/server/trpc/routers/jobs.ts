import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  addJobPhotoInput,
  checkInInput,
  completeChecklistItemInput,
  qcCheckInput,
  updateJobInput,
  upsertBayInput,
} from "@/lib/schemas/production";
import { JOB_STAGE_KEYS } from "@/lib/production-catalog";
import {
  createTRPCRouter,
  orgProcedure,
  requirePermission,
} from "../init";
import { recordTimelineEvent } from "@/server/audit/timeline";
import { inngest } from "@/server/jobs/client";
import { prisma } from "@/server/db";
import { finalizeCheckIn } from "@/server/services/finalize-check-in";

export const jobsRouter = createTRPCRouter({
  // -------- Bays --------
  listBays: orgProcedure
    .use(requirePermission("jobs:read"))
    .query(({ ctx }) =>
      ctx.db.bay.findMany({
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: { location: { select: { id: true, name: true } } },
      }),
    ),

  upsertBay: orgProcedure
    .use(requirePermission("settings:write"))
    .meta({ audit: { entity: "bay", action: "upsert" } })
    .input(upsertBayInput)
    .mutation(async ({ ctx, input }) => {
      if (input.id) {
        const { id, ...rest } = input;
        return ctx.db.bay.update({ where: { id }, data: rest });
      }
      return ctx.db.bay.create({
        data: {
          ...input,
          organizationId: ctx.session.organizationId,
        },
      });
    }),

  // -------- Jobs --------
  list: orgProcedure
    .use(requirePermission("jobs:read"))
    .input(
      z
        .object({
          status: z.enum(JOB_STAGE_KEYS as [string, ...string[]]).optional(),
          customerId: z.string().uuid().optional(),
          bayId: z.string().uuid().optional(),
          techUserId: z.string().uuid().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const items = await ctx.db.job.findMany({
        take: 200,
        orderBy: [{ scheduledStart: "asc" }, { createdAt: "desc" }],
        where: {
          deletedAt: null,
          status: input?.status ?? undefined,
          customerId: input?.customerId ?? undefined,
          bayId: input?.bayId ?? undefined,
          ...(input?.techUserId
            ? { assignedTechIds: { has: input.techUserId } }
            : {}),
        },
        include: {
          customer: { select: { id: true, name: true } },
          vehicle: { select: { id: true, year: true, make: true, model: true, trim: true, vin: true } },
          bay: { select: { id: true, name: true } },
          quote: { select: { id: true, number: true } },
        },
      });
      return { items };
    }),

  /**
   * Approved jobs that haven't been dropped on the calendar yet. Powers the
   * "Pending Scheduling" panel visible on the quotes list, dashboard, and
   * schedule page — a shop needs a single place to see everything a
   * customer has said yes to but no one has slotted onto a specific day yet.
   *
   * Definition:
   *   status ∈ { approved, ready } — customer has approved (deposit either
   *   collected or pending) AND
   *   scheduledStart IS NULL — no calendar slot assigned yet.
   */
  pendingScheduling: orgProcedure
    .use(requirePermission("jobs:read"))
    .query(async ({ ctx }) => {
      const items = await ctx.db.job.findMany({
        take: 200,
        orderBy: { createdAt: "asc" },
        where: {
          deletedAt: null,
          scheduledStart: null,
          status: { in: ["approved", "ready"] },
        },
        include: {
          customer: { select: { id: true, name: true } },
          vehicle: {
            select: { id: true, year: true, make: true, model: true, trim: true },
          },
          quote: { select: { id: true, number: true } },
        },
      });
      return { items };
    }),

  get: orgProcedure
    .use(requirePermission("jobs:read"))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const job = await ctx.db.job.findFirst({
        where: { id: input.id, deletedAt: null },
        include: {
          customer: true,
          vehicle: true,
          bay: true,
          quote: {
            select: {
              id: true,
              number: true,
              totalCents: true,
              items: {
                orderBy: { sortOrder: "asc" },
                select: {
                  id: true,
                  description: true,
                  quantity: true,
                  unit: true,
                  totalCents: true,
                  isUpsell: true,
                  upsellAccepted: true,
                },
              },
            },
          },
          workOrder: { include: { items: { orderBy: { sortOrder: "asc" } } } },
          checkIn: true,
          qcCheck: true,
          photos: { orderBy: [{ phase: "asc" }, { sortOrder: "asc" }] },
          timeEntries: { orderBy: { clockIn: "desc" }, take: 50 },
        },
      });
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });
      return job;
    }),

  update: orgProcedure
    .use(requirePermission("jobs:write"))
    .meta({ audit: { entity: "job", action: "update" } })
    .input(updateJobInput)
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      const before = await ctx.db.job.findFirst({ where: { id }, select: { status: true } });
      const updated = await ctx.db.job.update({ where: { id }, data: rest });
      if (rest.status && before?.status !== rest.status) {
        await recordTimelineEvent(ctx.session.organizationId, {
          entityType: "job" as never,
          entityId: id,
          kind: "job.stage_changed",
          actorUserId: ctx.session.userId,
          data: { from: before?.status, to: rest.status },
        });
        await recordTimelineEvent(ctx.session.organizationId, {
          entityType: "customer",
          entityId: updated.customerId,
          kind: "job.stage_changed",
          actorUserId: ctx.session.userId,
          data: { jobId: id, from: before?.status, to: rest.status },
        });
      }
      return updated;
    }),

  // -------- Photos --------
  addPhoto: orgProcedure
    .use(requirePermission("jobs:write"))
    .meta({ audit: { entity: "job_photo", action: "add" } })
    .input(addJobPhotoInput)
    .mutation(async ({ ctx, input }) => {
      const count = await ctx.db.jobPhoto.count({
        where: { jobId: input.jobId, phase: input.phase },
      });
      return ctx.db.jobPhoto.create({
        data: {
          ...input,
          organizationId: ctx.session.organizationId,
          sortOrder: count,
          uploadedByUserId: ctx.session.userId,
        },
      });
    }),

  // -------- Checklist items --------
  toggleChecklistItem: orgProcedure
    .use(requirePermission("jobs:write"))
    .meta({ audit: { entity: "checklist_item", action: "toggle" } })
    .input(completeChecklistItemInput.extend({
      completed: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.checklistItem.update({
        where: { id: input.id },
        data: input.completed
          ? {
              completedByUserId: ctx.session.userId,
              completedAt: new Date(),
              note: input.note ?? null,
              photoFileIds: input.photoFileIds,
            }
          : {
              completedByUserId: null,
              completedAt: null,
            },
      });
    }),

  // -------- Check-in --------
  submitCheckIn: orgProcedure
    .use(requirePermission("jobs:checkin"))
    .meta({ audit: { entity: "check_in", action: "submit" } })
    .input(checkInInput)
    .mutation(async ({ ctx, input }) => {
      const { jobId, ...patch } = input;
      const res = await finalizeCheckIn(prisma, {
        jobId,
        organizationId: ctx.session.organizationId,
        performedByUserId: ctx.session.userId,
        reason: "form",
        patch: {
          ...patch,
          exteriorConditionJson: patch.exteriorConditionJson as never,
          interiorConditionJson: patch.interiorConditionJson as never,
        },
        timelineData: {
          mileage: input.mileage,
          fuelLevelEighths: input.fuelLevelEighths,
        },
      });
      return { id: res.checkInId };
    }),

  // -------- QC --------
  submitQC: orgProcedure
    .use(requirePermission("jobs:complete"))
    .meta({ audit: { entity: "qc_check", action: "submit" } })
    .input(qcCheckInput)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.qCCheck.findFirst({ where: { jobId: input.jobId } });
      const data = {
        ...input,
        organizationId: ctx.session.organizationId,
        passedByUserId: ctx.session.userId,
        punchListJson: input.punchListJson as never,
      };
      const qc = existing
        ? await ctx.db.qCCheck.update({ where: { id: existing.id }, data })
        : await ctx.db.qCCheck.create({ data });

      if (input.passed) {
        await ctx.db.job.update({
          where: { id: input.jobId },
          data: { status: "ready_for_pickup" },
        });
      }

      await recordTimelineEvent(ctx.session.organizationId, {
        entityType: "job" as never,
        entityId: input.jobId,
        kind: input.passed ? "job.qc_passed" : "job.qc_failed",
        actorUserId: ctx.session.userId,
        data: { punchListCount: input.punchListJson.length },
      });
      return qc;
    }),

  // -------- Delivery --------
  markDelivered: orgProcedure
    .use(requirePermission("jobs:complete"))
    .meta({ audit: { entity: "job", action: "deliver" } })
    .input(
      z.object({
        id: z.string().uuid(),
        // When true, the delivered event carries a `notifyCustomer: true`
        // flag so the downstream aftercare handler queues a balance-due /
        // "job complete" email. False = flip the stage silently.
        notifyCustomer: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.db.job.update({
        where: { id: input.id },
        data: {
          status: "delivered",
          deliveredAt: new Date(),
          actualEnd: new Date(),
        },
      });
      await recordTimelineEvent(ctx.session.organizationId, {
        entityType: "job" as never,
        entityId: job.id,
        kind: "job.delivered",
        actorUserId: ctx.session.userId,
        data: { notifyCustomer: input.notifyCustomer },
      });
      await recordTimelineEvent(ctx.session.organizationId, {
        entityType: "customer",
        entityId: job.customerId,
        kind: "job.delivered",
        actorUserId: ctx.session.userId,
        data: { jobId: job.id, jobNumber: job.number },
      });
      // Fire the downstream aftermath (aftercare email + warranty + review request).
      await inngest.send({
        name: "job.delivered",
        data: {
          orgId: ctx.session.organizationId,
          jobId: job.id,
          customerId: job.customerId,
          notifyCustomer: input.notifyCustomer,
        },
      });
      return job;
    }),
});
