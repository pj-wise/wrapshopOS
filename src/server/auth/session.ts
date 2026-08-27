import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { createSupabaseServerClient } from "./supabase-server";
import { prisma } from "@/server/db";

export type AppSession = {
  userId: string;
  email: string;
  name: string | null;
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  organizationTier: "starter" | "pro" | "enterprise";
  locationId: string | null;
  memberId: string;
  roleKey: string;
  permissions: Set<string>;
};

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
    organizationTier: member.organization.tier as "starter" | "pro" | "enterprise",
    locationId: member.locationId,
    memberId: member.id,
    roleKey: member.role.key,
    permissions: new Set(member.role.permissions.map((rp) => rp.permissionKey)),
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
