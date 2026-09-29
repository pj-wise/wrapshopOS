"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createSupabaseServerClient } from "@/server/auth/supabase-server";
import { provisionOrganizationForUser } from "@/server/auth/provisioning";

const CreateOrgInput = z.object({
  name: z.string().min(2).max(80),
});

export type CreateOrgResult =
  | { ok: true; orgId: string; slug: string }
  | { ok: false; error: string };

/**
 * Server action: creates a new Organization + a default Location + Owner
 * OrgMember for the signed-in user. Fallback path — used when a user
 * signed in via OTP without going through the rich /signup form. Real
 * work happens in `provisionOrganizationForUser`.
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

  const result = await provisionOrganizationForUser({
    userId: user.id,
    businessName: parsed.data.name,
  });

  if (result.ok) revalidatePath("/dashboard");
  return result;
}
