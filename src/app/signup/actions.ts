"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/server/auth/supabase-server";
import { provisionOrganizationForUser } from "@/server/auth/provisioning";
import { prisma } from "@/server/db";
import { env } from "@/env";
import { signUpInput, type SignUpInput } from "@/lib/schemas/signup";

export type SignUpResult =
  | { ok: true; needsEmailVerify: boolean }
  | { ok: false; error: string };

/**
 * Sign up a shop owner in one shot:
 *   1. Validate the whole payload.
 *   2. Call supabase.auth.signUp — creates the auth user + fires the
 *      on_auth_user_created Postgres trigger that mirrors the account
 *      into public.users.
 *   3. Provision Organization + Location + owner OrgMember via the shared
 *      helper (also used by /onboarding).
 *
 * If Supabase requires email verification, `session` is null; the account
 * still exists and the org is created — the user just has to click the
 * confirmation email before they can sign in. Redirect them to
 * /signup/verify in that case.
 */
export async function signUpAction(input: SignUpInput): Promise<SignUpResult> {
  const parsed = signUpInput.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      ok: false,
      error: first?.message ?? "Some fields are missing or invalid.",
    };
  }
  const data = parsed.data;
  const supabase = await createSupabaseServerClient();

  // Redirect target for the confirm-email link. Uses NEXT_PUBLIC_APP_URL so
  // the link always lands back on our /auth/callback → dashboard chain.
  const emailRedirectTo = `${env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/dashboard`;

  const { data: signUpData, error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      emailRedirectTo,
      data: {
        name: `${data.firstName} ${data.lastName}`.trim(),
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.personalPhone ?? null,
      },
    },
  });

  if (error) {
    return { ok: false, error: mapSupabaseError(error.message) };
  }
  const authUserId = signUpData.user?.id;
  if (!authUserId) {
    return {
      ok: false,
      error: "Signup succeeded but no user was returned. Try signing in.",
    };
  }

  // The `on_auth_user_created` trigger mirrors auth.users → public.users
  // synchronously in the same transaction, but Supabase's rest layer can
  // return before we can query. Retry once with a small delay if the
  // public row isn't visible yet.
  let publicUser = await prisma.user.findUnique({
    where: { id: authUserId },
    select: { id: true },
  });
  if (!publicUser) {
    await new Promise((r) => setTimeout(r, 150));
    publicUser = await prisma.user.findUnique({
      where: { id: authUserId },
      select: { id: true },
    });
  }
  if (!publicUser) {
    return {
      ok: false,
      error:
        "Account created but not yet mirrored. Refresh and sign in — everything should work.",
    };
  }

  const provisioned = await provisionOrganizationForUser({
    userId: authUserId,
    businessName: data.businessName,
    profile: {
      legalName: data.businessName,
      shopPhone: data.shopPhone,
      servicesOffered: data.servicesOffered,
      currentScheduling: data.currentScheduling,
      currentInvoicing: data.currentInvoicing,
    },
  });

  if (!provisioned.ok) {
    // Auth user + public.users row exist, but we couldn't create the org
    // (e.g. system roles missing). Surface the error; the user can log in
    // and complete /onboarding as a fallback.
    return { ok: false, error: provisioned.error };
  }

  revalidatePath("/dashboard");

  return { ok: true, needsEmailVerify: signUpData.session === null };
}

/**
 * Map Supabase auth error strings to shop-owner-friendly copy.
 */
function mapSupabaseError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("already registered") || lower.includes("already exists")) {
    return "That email is already registered. Try signing in instead.";
  }
  if (lower.includes("password")) return message; // e.g. "Password should be at least…"
  if (lower.includes("invalid email")) return "Please enter a valid email.";
  return message;
}
