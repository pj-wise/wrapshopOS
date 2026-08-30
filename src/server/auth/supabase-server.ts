import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { env } from "@/env";

/**
 * Supabase server client for use inside Server Components, Server Actions,
 * Route Handlers, and tRPC procedures.
 *
 * Next.js 16: `cookies()` is async. Always await.
 *
 * NOT for route handlers that must persist a new session (sign-in, OAuth
 * callback): `setAll` writes to the request-scoped store, so cookies never
 * reach a separately constructed `NextResponse.redirect(...)`. Those routes
 * should build the response first and set cookies on it — see
 * `src/app/auth/callback/route.ts`.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component — Next won't let us set cookies.
            // This catch exists only for that path; the proxy refreshes the
            // session on the next request.
          }
        },
      },
    },
  );
}

/**
 * Service-role client — bypasses RLS. Use ONLY for:
 *  - Inngest workers whose actor is a system principal
 *  - Webhook handlers before an org is resolved
 *  - Cross-org admin ops
 *
 * Never expose a service-role client to a user request path.
 */
export function createSupabaseServiceClient() {
  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    },
  );
}
