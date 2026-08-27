import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { env } from "@/env";

/**
 * Supabase server client for use inside Server Components, Server Actions,
 * Route Handlers, and tRPC procedures.
 *
 * Next.js 16: `cookies()` is async. Always await.
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
            // called from a Server Component — Next won't let us set cookies.
            // Proxy will refresh the session on the next request.
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
