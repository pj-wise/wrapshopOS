/**
 * Demo mode — set `NEXT_PUBLIC_DEMO_MODE=true` to run the whole app against an
 * in-memory Postgres (PGlite) seeded with a sample shop, with no Supabase.
 * Auth is a cookie set by the "Explore the demo" button on /login.
 *
 * NEXT_PUBLIC_ so the client (login form, user menu) can read the same flag.
 * Client-safe: no server imports here.
 */

export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export const DEMO_EMAIL = "demo@nymbl.com";
export const DEMO_PASSWORD = "nymbl";
export const DEMO_NAME = "Demo User";

/** Fixed id so the demo DB and the session cookie agree across restarts. */
export const DEMO_USER_ID = "00000000-0000-4000-8000-0000000d3e00";

export const DEMO_SESSION_COOKIE = "demo_session";
