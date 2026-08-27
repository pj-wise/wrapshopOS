import "server-only";

import { z } from "zod";

import { upsertTemplateInput } from "@/lib/schemas/comms";
import {
  createTRPCRouter,
  orgProcedure,
  requirePermission,
} from "../init";
import { extractVariables } from "@/lib/template-render";

export const templatesRouter = createTRPCRouter({
  list: orgProcedure
    .use(requirePermission("messaging:read"))
    .input(
      z
        .object({ channel: z.enum(["email", "sms"]).optional() })
        .optional(),
    )
    .query(({ ctx, input }) =>
      ctx.db.messageTemplate.findMany({
        where: { deletedAt: null, channel: input?.channel ?? undefined },
        orderBy: { name: "asc" },
      }),
    ),

  upsert: orgProcedure
    .use(requirePermission("messaging:templates"))
    .meta({ audit: { entity: "message_template", action: "upsert" } })
    .input(upsertTemplateInput)
    .mutation(async ({ ctx, input }) => {
      const variables = Array.from(
        new Set([
          ...extractVariables(input.subject ?? ""),
          ...extractVariables(input.body),
        ]),
      );
      if (input.id) {
        const { id, ...rest } = input;
        return ctx.db.messageTemplate.update({
          where: { id },
          data: { ...rest, variables },
        });
      }
      return ctx.db.messageTemplate.create({
        data: {
          ...input,
          organizationId: ctx.session.organizationId,
          variables,
        },
      });
    }),

  softDelete: orgProcedure
    .use(requirePermission("messaging:templates"))
    .meta({ audit: { entity: "message_template", action: "delete" } })
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.messageTemplate.update({
        where: { id: input.id },
        data: { deletedAt: new Date() },
      });
      return { ok: true };
    }),
});
