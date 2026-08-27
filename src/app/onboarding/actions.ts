"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createSupabaseServerClient } from "@/server/auth/supabase-server";
import { prisma } from "@/server/db";

const CreateOrgInput = z.object({
  name: z.string().min(2).max(80),
});

export type CreateOrgResult =
  | { ok: true; orgId: string; slug: string }
  | { ok: false; error: string };

/**
 * Server action: creates a new Organization + a default Location + Owner
 * OrgMember for the signed-in user. Idempotent-ish — a user that already
 * has any membership can't create another org here (redirects them).
 */
export async function createOrganizationAction(
  input: z.infer<typeof CreateOrgInput>,
): Promise<CreateOrgResult> {
  const parsed = CreateOrgInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const existing = await prisma.orgMember.findFirst({
    where: { userId: user.id, status: "active" },
    select: { organizationId: true },
  });
  if (existing) return { ok: false, error: "You already belong to a shop." };

  // Find the system Owner role.
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

  const slug = slugify(parsed.data.name);

  const org = await prisma.$transaction(async (tx) => {
    const created = await tx.organization.create({
      data: {
        name: parsed.data.name,
        slug: `${slug}-${randomSuffix()}`,
        tier: "starter",
        subscriptionStatus: "trialing",
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
        userId: user.id,
        roleId: ownerRole.id,
        status: "active",
      },
    });
    return created;
  });

  revalidatePath("/dashboard");
  return { ok: true, orgId: org.id, slug: org.slug };
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "shop";
}

function randomSuffix(): string {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
