import "server-only";

import { prisma } from "@/server/db";

/**
 * Extra business profile captured on signup and stashed on
 * `Organization.settings.profile`. Every field is optional so this can be
 * called from both the rich signup flow AND the minimal onboarding
 * fallback (which only passes `businessName`).
 */
export type OrganizationProfileInput = {
  /** Legal DBA / registered business name. Different from display name if needed. */
  legalName?: string;
  /** Shop's main customer-facing phone. */
  shopPhone?: string;
  /** ["wrap", "tint", "ppf", "ceramic", "detailing", "other"] */
  servicesOffered?: readonly string[];
  /** What they use today for scheduling (dropdown value, e.g. "google_calendar"). */
  currentScheduling?: string;
  /** What they use today for invoicing. */
  currentInvoicing?: string;
};

export type ProvisionOrganizationInput = {
  userId: string;
  /** Display name for the org — required. Legal name goes into profile if different. */
  businessName: string;
  profile?: OrganizationProfileInput;
};

export type ProvisionOrganizationResult =
  | { ok: true; orgId: string; slug: string }
  | { ok: false; error: string };

/**
 * Create Organization + Main Location + owner OrgMember for a user in one
 * transaction. Extracted from onboarding/actions.ts so the signup flow and
 * the fallback onboarding flow share it.
 *
 * Idempotent-ish: refuses if the user already has an active membership
 * anywhere. Callers should check first if they want a specific error.
 */
export async function provisionOrganizationForUser(
  input: ProvisionOrganizationInput,
): Promise<ProvisionOrganizationResult> {
  const { userId, businessName, profile } = input;

  const existing = await prisma.orgMember.findFirst({
    where: { userId, status: "active" },
    select: { organizationId: true },
  });
  if (existing) {
    return { ok: false, error: "You already belong to a shop." };
  }

  const ownerRole = await prisma.role.findFirst({
    where: { organizationId: null, key: "owner" },
    select: { id: true },
  });
  if (!ownerRole) {
    return {
      ok: false,
      error: "System roles not seeded. Run `pnpm db:seed`.",
    };
  }

  const slug = slugify(businessName);
  const settingsPayload = profile
    ? {
        profile: {
          legalName: profile.legalName ?? null,
          shopPhone: profile.shopPhone ?? null,
          servicesOffered: profile.servicesOffered ?? [],
          currentSoftware: {
            scheduling: profile.currentScheduling ?? null,
            invoicing: profile.currentInvoicing ?? null,
          },
          signupCompletedAt: new Date().toISOString(),
        },
      }
    : undefined;

  const org = await prisma.$transaction(async (tx) => {
    const created = await tx.organization.create({
      data: {
        name: businessName,
        slug: `${slug}-${randomSuffix()}`,
        tier: "free",
        subscriptionStatus: "active",
        ...(settingsPayload ? { settings: settingsPayload } : {}),
      },
    });
    await tx.location.create({
      data: {
        organizationId: created.id,
        name: "Main",
      },
    });
    await tx.orgMember.create({
      data: {
        organizationId: created.id,
        userId,
        roleId: ownerRole.id,
        status: "active",
      },
    });
    return created;
  });

  return { ok: true, orgId: org.id, slug: org.slug };
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "shop"
  );
}

function randomSuffix(): string {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
