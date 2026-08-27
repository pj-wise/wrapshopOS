import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, orgProcedure, requirePermission } from "../init";

const createWarrantyInput = z.object({
  jobId: z.string().uuid(),
  customerId: z.string().uuid(),
  serviceName: z.string().trim().min(1).max(200),
  termMonths: z.number().int().min(0).max(360),
  installDate: z.coerce.date(),
  manufacturerWarranty: z.string().trim().optional(),
  filmDetails: z.string().trim().optional(),
  installer: z.string().trim().optional(),
});

export const warrantiesRouter = createTRPCRouter({
  list: orgProcedure
    .use(requirePermission("jobs:read"))
    .input(
      z
        .object({
          customerId: z.string().uuid().optional(),
          jobId: z.string().uuid().optional(),
          limit: z.number().int().min(1).max(200).default(100),
        })
        .optional(),
    )
    .query(({ ctx, input }) =>
      ctx.db.warranty.findMany({
        where: {
          customerId: input?.customerId ?? undefined,
          jobId: input?.jobId ?? undefined,
        },
        include: {
          customer: { select: { id: true, name: true } },
          job: { select: { id: true, number: true } },
        },
        orderBy: { installDate: "desc" },
        take: input?.limit ?? 100,
      }),
    ),

  get: orgProcedure
    .use(requirePermission("jobs:read"))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const w = await ctx.db.warranty.findFirst({
        where: { id: input.id },
        include: { customer: true, job: true },
      });
      if (!w) throw new TRPCError({ code: "NOT_FOUND" });
      return w;
    }),

  create: orgProcedure
    .use(requirePermission("jobs:complete"))
    .meta({ audit: { entity: "warranty", action: "create" } })
    .input(createWarrantyInput)
    .mutation(({ ctx, input }) => {
      const expiresAt = new Date(input.installDate);
      expiresAt.setMonth(expiresAt.getMonth() + input.termMonths);
      return ctx.db.warranty.create({
        data: {
          organizationId: ctx.session.organizationId,
          jobId: input.jobId,
          customerId: input.customerId,
          serviceName: input.serviceName,
          termMonths: input.termMonths,
          manufacturerWarranty: input.manufacturerWarranty ?? null,
          filmDetails: input.filmDetails ?? null,
          installer: input.installer ?? null,
          installDate: input.installDate,
          expiresAt,
        },
      });
    }),
});
