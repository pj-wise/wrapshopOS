import "server-only";

import { cookies } from "next/headers";

import { DEMO_EMAIL, DEMO_MODE, DEMO_SESSION_COOKIE, DEMO_USER_ID } from "@/lib/demo";
import { createSupabaseServerClient } from "./supabase-server";

export type AuthUser = { id: string; email: string | null };

/**
 * The signed-in user for this request, or null. Use this instead of calling
 * `supabase.auth.getUser()` directly so demo mode (no Supabase, cookie-based
 * session — see src/lib/demo.ts) works everywhere.
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  if (DEMO_MODE) {
    const cookieStore = await cookies();
    return cookieStore.get(DEMO_SESSION_COOKIE)?.value === DEMO_USER_ID
      ? { id: DEMO_USER_ID, email: DEMO_EMAIL }
      : null;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { id: user.id, email: user.email ?? null } : null;
}
