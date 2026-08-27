import "server-only";

import { z } from "zod";

import { authedProcedure, createTRPCRouter, orgProcedure, requirePermission } from "../init";
import { featureService } from "@/server/features/service";
import { FEATURE_KEYS, type FeatureKey } from "@/lib/features";

export const featuresRouter = createTRPCRouter({
  resolveAll: authedProcedure.query(async ({ ctx }) => {
    return await featureService.resolveAll({
      orgId: ctx.session.organizationId,
      orgTier: ctx.session.organizationTier,
      userId: ctx.session.userId,
      locationId: ctx.session.locationId,
    });
  }),

  setOverride: orgProcedure
    .use(requirePermission("admin:flags"))
    .meta({ audit: { entity: "feature_override", action: "set" } })
    .input(
      z.object({
        featureKey: z.enum(FEATURE_KEYS as [FeatureKey, ...FeatureKey[]]),
        scope: z.enum(["org", "location", "user"]),
        scopeId: z.string().uuid().nullable().optional(),
        userId: z.string().uuid().nullable().optional(),
        state: z.enum([
          "enabled",
          "disabled",
          "coming_soon",
          "beta",
          "requires_integration",
          "requires_subscription",
          "unavailable",
        ]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.featureOverride.upsert({
        where: {
          organizationId_scope_scopeId_featureKey: {
            organizationId: ctx.session.organizationId,
            scope: input.scope,
            scopeId: input.scopeId ?? (null as unknown as string),
            featureKey: input.featureKey,
          },
        },
        create: {
          organizationId: ctx.session.organizationId,
          scope: input.scope,
          scopeId: input.scopeId ?? null,
          userId: input.scope === "user" ? input.userId ?? null : null,
          featureKey: input.featureKey,
          state: input.state,
        },
        update: {
          state: input.state,
        },
      });
    }),
});
