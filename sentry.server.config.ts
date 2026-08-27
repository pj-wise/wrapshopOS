import * as Sentry from "@sentry/nextjs";

// Only init if SENTRY_DSN is present — keeps local dev quiet.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    // Cap sample rate — a busy shop can generate a lot of tRPC traffic.
    tracesSampleRate: 0.1,
    // Filter tRPC errors that are user-facing (BAD_REQUEST, UNAUTHORIZED, etc.)
    // from Sentry — they're expected control flow.
    beforeSend(event) {
      const message = event.message ?? event.exception?.values?.[0]?.value ?? "";
      if (
        message.includes("UNAUTHORIZED") ||
        message.includes("FORBIDDEN") ||
        message.includes("NOT_FOUND") ||
        message.includes("BAD_REQUEST")
      ) {
        return null;
      }
      return event;
    },
  });
}
