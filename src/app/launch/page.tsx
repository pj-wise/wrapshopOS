import { redirect } from "next/navigation";

import { getAuthUser } from "@/server/auth/current-user";

/**
 * PWA launch dispatcher. The manifest's `start_url` points here so the OS
 * always opens the app at a predictable entry — this route then decides
 * where to actually land based on auth state:
 *
 *   - Signed in → /dashboard (the daily-use surface).
 *   - Not signed in → /calculator (the free public tool). More useful than
 *     bouncing straight to /login for a shop owner who just installed the
 *     app to try it out.
 *
 * Runs on every launch. Zero client-side flash because the redirect fires
 * server-side before the shell renders.
 */
export const dynamic = "force-dynamic";

export default async function LaunchPage() {
  const user = await getAuthUser();

  if (user) {
    redirect("/dashboard");
  }
  redirect("/calculator");
}
