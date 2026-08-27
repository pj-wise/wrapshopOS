import * as Sentry from "@sentry/nextjs";

/**
 * Next.js instrumentation entry (runs before first request). Loads the
 * runtime-appropriate Sentry init file so both Node and Edge get initialized.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

/**
 * Next 16 `onRequestError` hook — forwarded to Sentry if configured, else no-op.
 * Named export is what Next auto-detects; no other wiring needed.
 */
export const onRequestError: typeof Sentry.captureRequestError = (...args) => {
  if (process.env.SENTRY_DSN) {
    return Sentry.captureRequestError(...args);
  }
};
