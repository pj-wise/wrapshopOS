import "server-only";

import { z } from "zod";

import { prisma } from "@/server/db";
import {
  createTRPCRouter,
  platformAdminProcedure,
} from "../init";

/**
 * Platform-operator surface. Everything here is gated on
 * `session.isPlatformAdmin` (driven by `PLATFORM_ADMIN_EMAILS`) — NOT any
 * org-level role. Adds cross-org visibility so the autoLuxOS operator
 * (me) can flip a tier or list every shop without joining their org.
 *
 * Not for tenant-facing UI. The `/admin/platform` page is the only
 * consumer today.
 */
export const platformRouter = createTRPCRouter({
  listOrgs: platformAdminProcedure.query(async () => {
    const rows = await prisma.organization.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        tier: true,
        subscriptionStatus: true,
        createdAt: true,
        _count: { select: { members: true, jobs: true, quotes: true } },
      },
    });
    return rows;
  }),

  updateOrgTier: platformAdminProcedure
    .meta({ audit: { entity: "organization", action: "platform_update_tier" } })
    .input(
      z.object({
        orgId: z.string().uuid(),
        tier: z.enum(["free", "solo", "shop", "pro", "enterprise"]),
      }),
    )
    .mutation(async ({ input }) => {
      await prisma.organization.update({
        where: { id: input.orgId },
        data: { tier: input.tier },
      });
      return { ok: true, orgId: input.orgId, tier: input.tier };
    }),
});
