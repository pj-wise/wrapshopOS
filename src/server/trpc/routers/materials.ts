import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createMaterialInput,
  createMaterialRollInput,
  createVendorInput,
  updateMaterialInput,
  updateMaterialRollInput,
  updateVendorInput,
} from "@/lib/schemas/catalog";
import {
  createTRPCRouter,
  orgProcedure,
  requirePermission,
} from "../init";

export const materialsRouter = createTRPCRouter({
  // -------- Vendors --------
  listVendors: orgProcedure
    .use(requirePermission("inventory:read"))
    .query(({ ctx }) =>
      ctx.db.vendor.findMany({
        where: { deletedAt: null },
        orderBy: { name: "asc" },
      }),
    ),

  createVendor: orgProcedure
    .use(requirePermission("inventory:write"))
    .meta({ audit: { entity: "vendor", action: "create" } })
    .input(createVendorInput)
    .mutation(({ ctx, input }) =>
      ctx.db.vendor.create({
        data: { ...input, organizationId: ctx.session.organizationId },
      }),
    ),

  updateVendor: orgProcedure
    .use(requirePermission("inventory:write"))
    .meta({ audit: { entity: "vendor", action: "update" } })
    .input(updateVendorInput)
    .mutation(({ ctx, input }) => {
      const { id, ...rest } = input;
      return ctx.db.vendor.update({ where: { id }, data: rest });
    }),

  // -------- Materials --------
  list: orgProcedure
    .use(requirePermission("inventory:read"))
    .input(
      z
        .object({
          q: z.string().trim().optional(),
          category: z.string().optional(),
        })
        .optional(),
    )
    .query(({ ctx, input }) =>
      ctx.db.material.findMany({
        where: {
          deletedAt: null,
          ...(input?.category ? { category: input.category } : {}),
          ...(input?.q
            ? {
                OR: [
                  { name: { contains: input.q, mode: "insensitive" } },
                  { manufacturer: { contains: input.q, mode: "insensitive" } },
                  { series: { contains: input.q, mode: "insensitive" } },
                  { color: { contains: input.q, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        include: {
          vendor: { select: { id: true, name: true } },
          _count: { select: { rolls: { where: { retiredAt: null, deletedAt: null } } } },
        },
        orderBy: [{ manufacturer: "asc" }, { name: "asc" }],
        take: 200,
      }),
    ),

  get: orgProcedure
    .use(requirePermission("inventory:read"))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const m = await ctx.db.material.findFirst({
        where: { id: input.id, deletedAt: null },
        include: {
          vendor: true,
          rolls: {
            where: { deletedAt: null },
            orderBy: [{ retiredAt: "asc" }, { receivedAt: "desc" }],
          },
        },
      });
      if (!m) throw new TRPCError({ code: "NOT_FOUND" });
      return m;
    }),

  create: orgProcedure
    .use(requirePermission("inventory:write"))
    .meta({ audit: { entity: "material", action: "create" } })
    .input(createMaterialInput)
    .mutation(({ ctx, input }) =>
      ctx.db.material.create({
        data: { ...input, organizationId: ctx.session.organizationId },
      }),
    ),

  update: orgProcedure
    .use(requirePermission("inventory:write"))
    .meta({ audit: { entity: "material", action: "update" } })
    .input(updateMaterialInput)
    .mutation(({ ctx, input }) => {
      const { id, ...rest } = input;
      return ctx.db.material.update({ where: { id }, data: rest });
    }),

  // -------- Material rolls --------
  listRolls: orgProcedure
    .use(requirePermission("inventory:read"))
    .input(z.object({ materialId: z.string().uuid() }).optional())
    .query(({ ctx, input }) =>
      ctx.db.materialRoll.findMany({
        where: {
          deletedAt: null,
          ...(input?.materialId ? { materialId: input.materialId } : {}),
        },
        include: { material: { select: { name: true, manufacturer: true } } },
        orderBy: { receivedAt: "desc" },
        take: 200,
      }),
    ),

  createRoll: orgProcedure
    .use(requirePermission("inventory:write"))
    .meta({ audit: { entity: "material_roll", action: "create" } })
    .input(createMaterialRollInput)
    .mutation(({ ctx, input }) =>
      ctx.db.materialRoll.create({
        data: { ...input, organizationId: ctx.session.organizationId },
      }),
    ),

  updateRoll: orgProcedure
    .use(requirePermission("inventory:write"))
    .meta({ audit: { entity: "material_roll", action: "update" } })
    .input(updateMaterialRollInput)
    .mutation(({ ctx, input }) => {
      const { id, ...rest } = input;
      return ctx.db.materialRoll.update({ where: { id }, data: rest });
    }),

  retireRoll: orgProcedure
    .use(requirePermission("inventory:write"))
    .meta({ audit: { entity: "material_roll", action: "retire" } })
    .input(z.object({ id: z.string().uuid() }))
    .mutation(({ ctx, input }) =>
      ctx.db.materialRoll.update({
        where: { id: input.id },
        data: { retiredAt: new Date() },
      }),
    ),
});
