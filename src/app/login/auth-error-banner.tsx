"use client";

import { useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle } from "lucide-react";

/**
 * Sign-in failures arrive through two completely separate channels:
 *
 *  - `?error=` — set by our own server-side redirects (`/auth/callback`).
 *  - `#error_description=` — set by Supabase's `/auth/v1/verify` endpoint.
 *    A URL fragment is never sent to the server, so this one is invisible to
 *    every server component and can only be read in the browser.
 *
 * Before this existed, both cases rendered a pristine, blank sign-in form and
 * the user had no idea anything had gone wrong.
 */
const FRIENDLY: Record<string, string> = {
  missing_code:
    "That sign-in link was no longer valid. Request a fresh code below — codes can't be consumed by email scanners the way links can.",
  no_user: "We couldn't load your account after sign-in. Please try again.",
};

/**
 * The fragment is browser-only state, so it goes through
 * `useSyncExternalStore` rather than an effect + setState: that gives us a
 * server snapshot for SSR and a hydration-safe client read.
 */
function subscribeToHash(onStoreChange: () => void) {
  window.addEventListener("hashchange", onStoreChange);
  return () => window.removeEventListener("hashchange", onStoreChange);
}

export function AuthErrorBanner() {
  const searchParams = useSearchParams();
  const hash = useSyncExternalStore(
    subscribeToHash,
    () => window.location.hash,
    () => "",
  );

  const fragment = new URLSearchParams(hash.replace(/^#/, ""));
  const hashError =
    fragment.get("error_description") ?? fragment.get("error") ?? null;

  const queryError = searchParams.get("error");
  // Supabase's own reason is more specific than our generic redirect code, so
  // it wins when both are present.
  const message =
    hashError ?? (queryError ? (FRIENDLY[queryError] ?? queryError) : null);

  if (!message) return null;

  return (
    <div
      role="alert"
      className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
