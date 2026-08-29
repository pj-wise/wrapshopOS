import "server-only";

import { env } from "@/env";
import { inngest } from "../client";
import { getEmailProvider } from "@/server/providers/registry";

/**
 * email.send — deliver a transactional email via the org's EmailProvider.
 * Idempotency: keyed by `event.id`; Inngest dedupes identical events within
 * 24h so a resend of the same event is a no-op.
 *
 * Dev safety: when NODE_ENV !== "production" and `DEV_EMAIL_OVERRIDE` is
 * set, we redirect every recipient to that address and stash the original
 * "to" list in `X-Original-To` for reference. This lets us test the whole
 * invoice-email flow against real Resend without ever touching a real
 * customer inbox.
 *
 * Retries: 3 attempts, exponential backoff (Inngest default).
 */
export const sendEmail = inngest.createFunction(
  {
    id: "email.send",
    name: "Send transactional email",
    retries: 3,
  },
  { event: "email.send" },
  async ({ event, step }) => {
    const provider = await step.run("resolve-provider", async () => {
      const p = await getEmailProvider(event.data.orgId);
      return { name: p.name };
    });

    const devOverride =
      env.NODE_ENV !== "production" && env.DEV_EMAIL_OVERRIDE
        ? env.DEV_EMAIL_OVERRIDE
        : null;

    const result = await step.run("send", async () => {
      const p = await getEmailProvider(event.data.orgId);
      const originalTo = Array.isArray(event.data.to)
        ? event.data.to.join(", ")
        : event.data.to;
      if (devOverride) {
        console.info(
          `[email.send] dev override: redirecting to=${originalTo} → ${devOverride}`,
        );
      }
      return await p.send({
        to: devOverride ?? event.data.to,
        subject: devOverride
          ? `[DEV → ${originalTo}] ${event.data.subject}`
          : event.data.subject,
        html: event.data.html,
        text: event.data.text,
        headers: devOverride
          ? { "X-Original-To": originalTo }
          : undefined,
      });
    });

    if (!result.ok) {
      throw new Error(`email send failed via ${provider.name}: ${result.error ?? "unknown"}`);
    }

    return {
      provider: provider.name,
      messageId: result.messageId,
      devOverride: devOverride ?? undefined,
    };
  },
);
