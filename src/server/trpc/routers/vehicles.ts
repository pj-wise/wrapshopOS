import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createVehicleInput,
  decodeVinInput,
  updateVehicleInput,
} from "@/lib/schemas/crm";
import {
  createTRPCRouter,
  orgProcedure,
  requirePermission,
} from "../init";
import { getVehicleProvider } from "@/server/providers/registry";
import { recordTimelineEvent } from "@/server/audit/timeline";

export const vehiclesRouter = createTRPCRouter({
  list: orgProcedure
    .use(requirePermission("crm:read"))
    .input(
      z
        .object({
          cursor: z.string().uuid().optional(),
          limit: z.number().int().min(1).max(100).default(50),
          customerId: z.string().uuid().optional(),
          q: z.string().trim().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 50;
      const cursor = input?.cursor;
      const q = input?.q?.toUpperCase();

      const rows = await ctx.db.vehicle.findMany({
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { createdAt: "desc" },
        where: {
          deletedAt: null,
          customerId: input?.customerId ?? undefined,
          ...(q
            ? {
                OR: [
                  { vin: { contains: q } },
                  { plate: { contains: q } },
                  { make: { contains: q, mode: "insensitive" } },
                  { model: { contains: q, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        include: { customer: { select: { id: true, name: true } } },
      });

      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, -1) : rows;
      return { items, nextCursor: hasMore ? items.at(-1)?.id ?? null : null };
    }),

  get: orgProcedure
    .use(requirePermission("crm:read"))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const vehicle = await ctx.db.vehicle.findFirst({
        where: { id: input.id, deletedAt: null },
        include: { customer: true },
      });
      if (!vehicle) throw new TRPCError({ code: "NOT_FOUND" });
      return vehicle;
    }),

  create: orgProcedure
    .use(requirePermission("crm:write"))
    .meta({ audit: { entity: "vehicle", action: "create" } })
    .input(createVehicleInput)
    .mutation(async ({ ctx, input }) => {
      const vehicle = await ctx.db.vehicle.create({
        data: {
          ...input,
          organizationId: ctx.session.organizationId,
          decodedData: (input.decodedData ?? {}) as never,
        },
      });
      await recordTimelineEvent(ctx.session.organizationId, {
        entityType: "vehicle",
        entityId: vehicle.id,
        kind: "vehicle.created",
        actorUserId: ctx.session.userId,
        data: { year: vehicle.year, make: vehicle.make, model: vehicle.model, vin: vehicle.vin },
      });
      if (vehicle.customerId) {
        await recordTimelineEvent(ctx.session.organizationId, {
          entityType: "customer",
          entityId: vehicle.customerId,
          kind: "vehicle.attached",
          actorUserId: ctx.session.userId,
          data: {
            vehicleId: vehicle.id,
            summary: [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" "),
          },
        });
      }
      return vehicle;
    }),

  update: orgProcedure
    .use(requirePermission("crm:write"))
    .meta({ audit: { entity: "vehicle", action: "update" } })
    .input(updateVehicleInput)
    .mutation(async ({ ctx, input }) => {
      const { id, decodedData, ...rest } = input;
      const vehicle = await ctx.db.vehicle.update({
        where: { id },
        data: {
          ...rest,
          ...(decodedData ? { decodedData: decodedData as never } : {}),
        },
      });
      await recordTimelineEvent(ctx.session.organizationId, {
        entityType: "vehicle",
        entityId: vehicle.id,
        kind: "vehicle.updated",
        actorUserId: ctx.session.userId,
        data: { changedFields: Object.keys(rest) },
      });
      return vehicle;
    }),

  softDelete: orgProcedure
    .use(requirePermission("crm:delete"))
    .meta({ audit: { entity: "vehicle", action: "delete" } })
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.vehicle.update({
        where: { id: input.id },
        data: { deletedAt: new Date() },
      });
      return { ok: true };
    }),

  /**
   * Decode a VIN via the org's active vehicle-data provider. Result is
   * returned to the client for confirmation; nothing is persisted here.
   * Persistence happens when the client calls `create` with the decoded
   * fields + `decodedData` payload.
   */
  decodeVin: orgProcedure
    .use(requirePermission("crm:read"))
    .input(decodeVinInput)
    .query(async ({ ctx, input }) => {
      const provider = await getVehicleProvider(ctx.session.organizationId);
      try {
        const decoded = await provider.decodeVin(input.vin);
        return { ok: true as const, decoded };
      } catch (err) {
        return {
          ok: false as const,
          error: err instanceof Error ? err.message : "VIN decode failed",
        };
      }
    }),

  /**
   * Models for a (year, make). Powers the cascading Year → Make → Model
   * picker in the customer + vehicle dialogs. Provider-agnostic — falls back
   * to [] if the org's active vehicle-data provider doesn't implement it.
   */
  models: orgProcedure
    .use(requirePermission("crm:read"))
    .input(
      z.object({
        year: z.number().int().min(1900).max(2100),
        make: z.string().trim().min(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      const provider = await getVehicleProvider(ctx.session.organizationId);
      if (!provider.getModels) return { models: [] as string[] };
      const models = await provider.getModels(input.year, input.make);
      return { models };
    }),
});
