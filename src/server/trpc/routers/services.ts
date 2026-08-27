import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createServiceCategoryInput,
  createServiceInput,
  updateServiceCategoryInput,
  updateServiceInput,
} from "@/lib/schemas/catalog";
import {
  createTRPCRouter,
  orgProcedure,
  requirePermission,
} from "../init";

export const servicesRouter = createTRPCRouter({
  // -------- Categories --------
  listCategories: orgProcedure
    .use(requirePermission("settings:read"))
    .query(({ ctx }) =>
      ctx.db.serviceCategory.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
    ),

  createCategory: orgProcedure
    .use(requirePermission("settings:write"))
    .meta({ audit: { entity: "service_category", action: "create" } })
    .input(createServiceCategoryInput)
    .mutation(({ ctx, input }) =>
      ctx.db.serviceCategory.create({
        data: { ...input, organizationId: ctx.session.organizationId },
      }),
    ),

  updateCategory: orgProcedure
    .use(requirePermission("settings:write"))
    .meta({ audit: { entity: "service_category", action: "update" } })
    .input(updateServiceCategoryInput)
    .mutation(({ ctx, input }) => {
      const { id, ...rest } = input;
      return ctx.db.serviceCategory.update({ where: { id }, data: rest });
    }),

  // -------- Services --------
  list: orgProcedure
    .use(requirePermission("settings:read"))
    .input(
      z
        .object({
          q: z.string().trim().optional(),
          categoryId: z.string().uuid().nullable().optional(),
          activeOnly: z.boolean().default(true),
        })
        .optional(),
    )
    .query(({ ctx, input }) =>
      ctx.db.service.findMany({
        where: {
          deletedAt: null,
          ...(input?.activeOnly !== false ? { active: true } : {}),
          ...(input?.categoryId ? { categoryId: input.categoryId } : {}),
          ...(input?.q
            ? {
                OR: [
                  { name: { contains: input.q, mode: "insensitive" } },
                  { sku: { contains: input.q, mode: "insensitive" } },
                  { description: { contains: input.q, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        include: { category: { select: { id: true, name: true, key: true } } },
        orderBy: [{ name: "asc" }],
        take: 200,
      }),
    ),

  get: orgProcedure
    .use(requirePermission("settings:read"))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const svc = await ctx.db.service.findFirst({
        where: { id: input.id, deletedAt: null },
        include: { category: true },
      });
      if (!svc) throw new TRPCError({ code: "NOT_FOUND" });
      return svc;
    }),

  create: orgProcedure
    .use(requirePermission("settings:write"))
    .meta({ audit: { entity: "service", action: "create" } })
    .input(createServiceInput)
    .mutation(({ ctx, input }) =>
      ctx.db.service.create({
        data: {
          ...input,
          organizationId: ctx.session.organizationId,
          matrixJson: input.matrixJson as never,
        },
      }),
    ),

  update: orgProcedure
    .use(requirePermission("settings:write"))
    .meta({ audit: { entity: "service", action: "update" } })
    .input(updateServiceInput)
    .mutation(({ ctx, input }) => {
      const { id, matrixJson, ...rest } = input;
      return ctx.db.service.update({
        where: { id },
        data: { ...rest, ...(matrixJson ? { matrixJson: matrixJson as never } : {}) },
      });
    }),

  softDelete: orgProcedure
    .use(requirePermission("settings:write"))
    .meta({ audit: { entity: "service", action: "delete" } })
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.service.update({
        where: { id: input.id },
        data: { deletedAt: new Date(), active: false },
      });
      return { ok: true };
    }),
});
