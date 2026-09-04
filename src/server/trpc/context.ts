import "server-only";

import type { NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/server/auth/supabase-server";
import { isPlatformAdminEmail } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { normalizeLegacyTier, type SubscriptionTier } from "@/lib/features";

/**
 * Re-export the tier type from features.ts as `OrgTier` so downstream files
 * keep working with the old alias. Legacy `"starter"` values still in the
 * DB are normalized to `"solo"` via normalizeLegacyTier on read.
 */
export type OrgTier = SubscriptionTier;

export type MinimalSession = {
  userId: string;
  email: string;
  organizationId: string;
  organizationTier: OrgTier;
  locationId: string | null;
  memberId: string;
  roleKey: string;
  permissions: Set<string>;
  isPlatformAdmin: boolean;
};

export type TRPCContext = {
  req: NextRequest;
  headers: Headers;
  session: MinimalSession | null;
};

/**
 * tRPC context factory. Runs on every request. Resolves the current Supabase
 * session and, if the user has an active org membership, materializes the
 * session bundle used by orgProcedure downstream.
 *
 * Session is NULL for unauthenticated requests — publicProcedure still works
 * (webhooks, health checks). authedProcedure / orgProcedure enforce.
 */
export async function createTRPCContext(opts: { req: NextRequest }): Promise<TRPCContext> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { req: opts.req, headers: opts.req.headers, session: null };
  }

  const member = await prisma.orgMember.findFirst({
    where: { userId: user.id, status: "active" },
    include: {
      organization: { select: { id: true, tier: true } },
      role: { include: { permissions: true } },
    },
    orderBy: { joinedAt: "desc" },
  });

  if (!member) {
    return { req: opts.req, headers: opts.req.headers, session: null };
  }

  return {
    req: opts.req,
    headers: opts.req.headers,
    session: {
      userId: user.id,
      email: user.email ?? "",
      organizationId: member.organizationId,
      organizationTier: normalizeLegacyTier(member.organization.tier),
      locationId: member.locationId,
      memberId: member.id,
      roleKey: member.role.key,
      permissions: new Set(member.role.permissions.map((rp) => rp.permissionKey)),
      isPlatformAdmin: isPlatformAdminEmail(user.email ?? ""),
    },
  };
}
