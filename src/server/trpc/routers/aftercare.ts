import "server-only";

import { z } from "zod";

import { createTRPCRouter, orgProcedure, requirePermission } from "../init";
import { extractVariables } from "@/lib/template-render";

const upsertAftercareInput = z.object({
  id: z.string().uuid().optional(),
  serviceCategoryId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(120),
  channel: z.enum(["email", "sms"]).default("email"),
  subject: z.string().trim().optional(),
  body: z.string().trim().min(1).max(20_000),
  active: z.boolean().default(true),
});

export const aftercareRouter = createTRPCRouter({
  list: orgProcedure
    .use(requirePermission("settings:read"))
    .query(({ ctx }) =>
      ctx.db.aftercareTemplate.findMany({
        orderBy: { name: "asc" },
        include: {
          serviceCategory: { select: { id: true, name: true, key: true } },
        },
      }),
    ),

  upsert: orgProcedure
    .use(requirePermission("settings:write"))
    .meta({ audit: { entity: "aftercare_template", action: "upsert" } })
    .input(upsertAftercareInput)
    .mutation(({ ctx, input }) => {
      // Track variables the template uses — surfaces in the settings UI so
      // shops know what's available at render time.
      const variables = Array.from(
        new Set([
          ...extractVariables(input.subject ?? ""),
          ...extractVariables(input.body),
        ]),
      );
      if (input.id) {
        const { id, ...rest } = input;
        return ctx.db.aftercareTemplate.update({
          where: { id },
          data: { ...rest, subject: rest.subject ?? null, serviceCategoryId: rest.serviceCategoryId ?? null },
        });
      }
      return ctx.db.aftercareTemplate.create({
        data: {
          organizationId: ctx.session.organizationId,
          serviceCategoryId: input.serviceCategoryId ?? null,
          name: input.name,
          channel: input.channel,
          subject: input.subject ?? null,
          body: input.body,
          active: input.active,
        },
      });
    }),

  delete: orgProcedure
    .use(requirePermission("settings:write"))
    .meta({ audit: { entity: "aftercare_template", action: "delete" } })
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.aftercareTemplate.delete({ where: { id: input.id } });
      return { ok: true };
    }),
});
