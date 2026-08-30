/**
 * Next.js 16 Proxy (formerly Middleware).
 *
 * Runs before every request that matches `config.matcher`. Refreshes the
 * Supabase auth session so Server Components see a fresh cookie.
 *
 * IMPORTANT (Next 16): use `proxy.ts`, not `middleware.ts`. Named export `proxy`.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Refresh session — must be called for cookies to be updated.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAppRoute = pathname.startsWith("/app") || matchesAppSegment(pathname);
  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/signup");

  // Redirect unauthenticated users hitting the app to /login.
  if (isAppRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return redirectWith(url, response);
  }

  // Redirect authenticated users away from /login.
  if (isAuthRoute && user) {
    const url = request.nextUrl.clone();
    url.pathname = url.searchParams.get("next") ?? "/dashboard";
    url.searchParams.delete("next");
    return redirectWith(url, response);
  }

  return response;
}

/**
 * `getUser()` above may rotate the refresh token, in which case `setAll` has
 * already rebuilt `response` with the new cookies. A bare
 * `NextResponse.redirect()` is a fresh object that inherits none of them — the
 * rotated tokens would be dropped while the old refresh token is already
 * spent, permanently breaking the session and looping the user back to
 * /login. Always carry the cookies across.
 */
function redirectWith(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url);
  for (const cookie of from.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}

// Route groups like `(app)/dashboard` render as `/dashboard`. Whitelist those.
function matchesAppSegment(pathname: string): boolean {
  const APP_SEGMENTS = [
    "/dashboard",
    "/inbox",
    "/leads",
    "/customers",
    "/vehicles",
    "/quotes",
    "/jobs",
    "/schedule",
    "/inventory",
    "/invoices",
    "/reports",
    "/admin",
    "/settings",
  ];
  return APP_SEGMENTS.some((s) => pathname === s || pathname.startsWith(`${s}/`));
}

export const config = {
  matcher: [
    // Skip Next.js internals, static assets, and the auth/API endpoints —
    // those build their own Supabase client, and two clients contending over
    // the same cookie jar on one request is how auth flows break.
    "/((?!_next/static|_next/image|favicon.ico|api/|auth/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
