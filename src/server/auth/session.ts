import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { createSupabaseServerClient } from "./supabase-server";
import { prisma } from "@/server/db";
import { env } from "@/env";
import { normalizeLegacyTier, type SubscriptionTier } from "@/lib/features";

export type AppSession = {
  userId: string;
  email: string;
  name: string | null;
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  organizationTier: SubscriptionTier;
  locationId: string | null;
  memberId: string;
  roleKey: string;
  permissions: Set<string>;
  /**
   * True when the signed-in user's email is in `PLATFORM_ADMIN_EMAILS`.
   * Grants cross-org visibility + tier control via `/admin/platform`.
   * Not the same as any org-level role — this bit is scoped to the
   * autoLuxOS operator (i.e. me/us), not to a shop tenant.
   */
  isPlatformAdmin: boolean;
};

/** Case-insensitive membership check against the env-driven allow list. */
export function isPlatformAdminEmail(email: string): boolean {
  const raw = env.PLATFORM_ADMIN_EMAILS ?? "";
  const list = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}

/**
 * Resolves the current user + their active org + role permissions.
 * Cached per-request so multiple server components share one lookup.
 * Redirects to /login or /onboarding as needed.
 */
export const getAppSession = cache(async (): Promise<AppSession> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const member = await prisma.orgMember.findFirst({
    where: { userId: user.id, status: "active" },
    include: {
      organization: true,
      role: {
        include: {
          permissions: true,
        },
      },
    },
    // TODO(stretch:multi-org-switcher): user preference for active org
    orderBy: { joinedAt: "desc" },
  });

  if (!member) redirect("/onboarding");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { name: true },
  });

  return {
    userId: user.id,
    email: user.email ?? "",
    name: dbUser?.name ?? null,
    organizationId: member.organizationId,
    organizationSlug: member.organization.slug,
    organizationName: member.organization.name,
    organizationTier: normalizeLegacyTier(member.organization.tier),
    locationId: member.locationId,
    memberId: member.id,
    roleKey: member.role.key,
    permissions: new Set(member.role.permissions.map((rp) => rp.permissionKey)),
    isPlatformAdmin: isPlatformAdminEmail(user.email ?? ""),
  };
});

export function hasPermission(session: AppSession, key: string): boolean {
  return session.permissions.has(key);
}

export function requirePermission(session: AppSession, key: string): void {
  if (!hasPermission(session, key)) {
    throw new Error(`Missing permission: ${key}`);
  }
}
