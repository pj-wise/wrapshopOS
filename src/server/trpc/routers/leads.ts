import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  convertLeadInput,
  createLeadInput,
  updateLeadInput,
} from "@/lib/schemas/crm";
import {
  createTRPCRouter,
  orgProcedure,
  requirePermission,
} from "../init";
import { getVehicleProvider } from "@/server/providers/registry";
import { recordTimelineEvent } from "@/server/audit/timeline";

export const leadsRouter = createTRPCRouter({
  list: orgProcedure
    .use(requirePermission("crm:read"))
    .input(
      z
        .object({
          cursor: z.string().uuid().optional(),
          limit: z.number().int().min(1).max(100).default(50),
          status: z.string().optional(),
          source: z.string().optional(),
          q: z.string().trim().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 50;
      const cursor = input?.cursor;
      const q = input?.q?.toLowerCase();

      const rows = await ctx.db.lead.findMany({
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { createdAt: "desc" },
        where: {
          deletedAt: null,
          status: input?.status ?? undefined,
          source: input?.source ?? undefined,
          ...(q
            ? {
                OR: [
                  { name: { contains: q, mode: "insensitive" } },
                  { email: { contains: q, mode: "insensitive" } },
                  { phone: { contains: q } },
                  { vehicleDescription: { contains: q, mode: "insensitive" } },
                ],
              }
            : {}),
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
      const lead = await ctx.db.lead.findFirst({
        where: { id: input.id, deletedAt: null },
        include: {
          convertedCustomer: { select: { id: true, name: true } },
          convertedVehicle: { select: { id: true, year: true, make: true, model: true, vin: true } },
        },
      });
      if (!lead) throw new TRPCError({ code: "NOT_FOUND" });
      return lead;
    }),

  create: orgProcedure
    .use(requirePermission("crm:write"))
    .meta({ audit: { entity: "lead", action: "create" } })
    .input(createLeadInput)
    .mutation(async ({ ctx, input }) => {
      const lead = await ctx.db.lead.create({
        data: { ...input, organizationId: ctx.session.organizationId },
      });
      await recordTimelineEvent(ctx.session.organizationId, {
        entityType: "lead",
        entityId: lead.id,
        kind: "lead.created",
        actorUserId: ctx.session.userId,
        data: { name: lead.name, source: lead.source },
      });
      return lead;
    }),

  update: orgProcedure
    .use(requirePermission("crm:write"))
    .meta({ audit: { entity: "lead", action: "update" } })
    .input(updateLeadInput)
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      const lead = await ctx.db.lead.update({ where: { id }, data: rest });
      if (rest.status) {
        await recordTimelineEvent(ctx.session.organizationId, {
          entityType: "lead",
          entityId: lead.id,
          kind: "lead.stage_changed",
          actorUserId: ctx.session.userId,
          data: { to: rest.status },
        });
      }
      return lead;
    }),

  softDelete: orgProcedure
    .use(requirePermission("crm:delete"))
    .meta({ audit: { entity: "lead", action: "delete" } })
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.lead.update({
        where: { id: input.id },
        data: { deletedAt: new Date() },
      });
      return { ok: true };
    }),

  /**
   * Convert lead → customer (+ optional vehicle by VIN or empty stub).
   * On success: marks the lead as converted (status="converted", convertedAt,
   * convertedCustomerId, convertedVehicleId) so the pipeline reports it as
   * won and we can walk from any customer back to its origin lead.
   */
  convert: orgProcedure
    .use(requirePermission("crm:write"))
    .meta({ audit: { entity: "lead", action: "convert" } })
    .input(convertLeadInput)
    .mutation(async ({ ctx, input }) => {
      const lead = await ctx.db.lead.findFirst({
        where: { id: input.id, deletedAt: null },
      });
      if (!lead) throw new TRPCError({ code: "NOT_FOUND" });
      if (lead.convertedCustomerId) {
        throw new TRPCError({ code: "CONFLICT", message: "Lead already converted." });
      }

      // Attempt VIN decode outside the transaction (network call).
      let decoded: Awaited<ReturnType<Awaited<ReturnType<typeof getVehicleProvider>>["decodeVin"]>> | null = null;
      if (input.vin) {
        try {
          const provider = await getVehicleProvider(ctx.session.organizationId);
          decoded = await provider.decodeVin(input.vin);
        } catch (err) {
          console.warn("[leads.convert] VIN decode failed, continuing without", err);
        }
      }

      const customer = await ctx.db.customer.create({
        data: {
          organizationId: ctx.session.organizationId,
          type: input.customerType,
          name: lead.name,
          email: lead.email ?? undefined,
          phone: lead.phone ?? undefined,
          referralSource: lead.source,
          tags: lead.tags,
          notes: lead.notes ?? undefined,
        },
      });

      let vehicle: Awaited<ReturnType<typeof ctx.db.vehicle.create>> | null = null;
      if (input.vin || input.createEmptyVehicle || lead.vehicleDescription) {
        vehicle = await ctx.db.vehicle.create({
          data: {
            organizationId: ctx.session.organizationId,
            customerId: customer.id,
            vin: input.vin,
            year: decoded?.year ?? null,
            make: decoded?.make ?? null,
            model: decoded?.model ?? null,
            trim: decoded?.trim ?? null,
            bodyStyle: decoded?.bodyClass ?? null,
            notes: lead.vehicleDescription ?? null,
            decodedData: (decoded?.raw ?? {}) as never,
          },
        });
      }

      const updated = await ctx.db.lead.update({
        where: { id: lead.id },
        data: {
          status: "converted",
          convertedAt: new Date(),
          convertedCustomerId: customer.id,
          convertedVehicleId: vehicle?.id ?? null,
        },
      });

      // Timeline breadcrumbs on all three entities.
      await Promise.all([
        recordTimelineEvent(ctx.session.organizationId, {
          entityType: "lead",
          entityId: lead.id,
          kind: "lead.converted",
          actorUserId: ctx.session.userId,
          data: { customerId: customer.id, vehicleId: vehicle?.id ?? null },
        }),
        recordTimelineEvent(ctx.session.organizationId, {
          entityType: "customer",
          entityId: customer.id,
          kind: "customer.created_from_lead",
          actorUserId: ctx.session.userId,
          data: { leadId: lead.id },
        }),
        vehicle
          ? recordTimelineEvent(ctx.session.organizationId, {
              entityType: "vehicle",
              entityId: vehicle.id,
              kind: "vehicle.created_from_lead",
              actorUserId: ctx.session.userId,
              data: { leadId: lead.id, customerId: customer.id },
            })
          : Promise.resolve(),
      ]);

      return { lead: updated, customer, vehicle };
    }),
});
