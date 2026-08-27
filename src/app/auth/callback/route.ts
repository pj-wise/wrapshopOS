/**
 * Supabase magic-link callback. Exchanges `code` for a session cookie, then
 * routes the user based on whether they already belong to any organization.
 *
 * Next.js 16: Route handler receives an async cookies() context; we go through
 * the supabase-server helper.
 */

import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/server/auth/supabase-server";
import { prisma } from "@/server/db";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", request.url));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url),
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login?error=no_user", request.url));
  }

  // Does this user already belong to an org?
  const membership = await prisma.orgMember.findFirst({
    where: { userId: user.id, status: "active" },
    select: { id: true },
  });

  if (!membership) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  return NextResponse.redirect(new URL(next, request.url));
}
