import "server-only";

import { inngest } from "../client";
import { getEmailProvider } from "@/server/providers/registry";

/**
 * email.send — deliver a transactional email via the org's EmailProvider.
 * Idempotency: keyed by `event.id`; Inngest dedupes identical events within
 * 24h so a resend of the same event is a no-op.
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

    const result = await step.run("send", async () => {
      const p = await getEmailProvider(event.data.orgId);
      return await p.send({
        to: event.data.to,
        subject: event.data.subject,
        html: event.data.html,
        text: event.data.text,
      });
    });

    if (!result.ok) {
      throw new Error(`email send failed via ${provider.name}: ${result.error ?? "unknown"}`);
    }

    return {
      provider: provider.name,
      messageId: result.messageId,
    };
  },
);
