import "server-only";

import type { EmailProvider, SendEmailInput, SendEmailResult } from "../types";

/**
 * No-op email provider — logs "would-send" and returns a fake messageId.
 * Used when RESEND_API_KEY is missing. Prevents dev crashes; every email in
 * the app funnels through the registry, so nothing needs an "if key" guard.
 */
export const noopEmailProvider: EmailProvider = {
  name: "email_noop",
  async send(input: SendEmailInput): Promise<SendEmailResult> {
    console.info("[email:noop] would-send", {
      to: input.to,
      subject: input.subject,
      preview: (input.text ?? input.html ?? "").slice(0, 120),
    });
    return {
      ok: true,
      messageId: `noop_${crypto.randomUUID()}`,
      provider: "email_noop",
    };
  },
  async healthCheck() {
    return { ok: true, checkedAt: new Date().toISOString(), message: "noop" };
  },
};
