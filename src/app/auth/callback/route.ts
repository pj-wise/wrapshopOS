/**
 * Supabase auth callback. Exchanges a `code` for a session cookie.
 *
 * The primary sign-in path is now email + password or a 6-digit emailed code
 * (both handled client-side on /login), so this route only serves stale
 * magic-link emails still sitting in inboxes and any future OAuth provider.
 *
 * Next.js 16: cookies must be written onto the response object we actually
 * return. Mutating the request-scoped `cookies()` store and then returning an
 * unrelated `NextResponse.redirect(...)` silently drops the session, which is
 * why this route builds the response first and hands its cookie jar to
 * `createServerClient`.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { env } from "@/env";

function loginRedirect(request: Request, error: string) {
  return NextResponse.redirect(
    new URL(`/login?error=${encodeURIComponent(error)}`, request.url),
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";

  // Supabase reports verify-endpoint failures in the URL *fragment*, which
  // never reaches the server — all we can see is the missing code. The banner
  // on /login reads that fragment client-side and shows the real reason.
  if (!code) {
    return loginRedirect(request, "missing_code");
  }

  const cookieStore = await cookies();
  const response = NextResponse.redirect(new URL(next, request.url));

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return loginRedirect(request, error.message);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return loginRedirect(request, "no_user");
  }

  // No membership lookup here — `getAppSession()` already redirects to
  // /onboarding when the user has no active OrgMember.
  return response;
}
