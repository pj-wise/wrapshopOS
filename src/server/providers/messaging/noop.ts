import "server-only";

import type { MessagingProvider, SendMessageInput, SendMessageResult } from "../types";

/**
 * No-op messaging provider. Records "would-send" attempts to the console —
 * NEVER sends real messages. Used when no MessagingProvider is configured for
 * the org. Every SMS-adjacent feature gates through here in Phase 2 so the
 * app has zero risk of accidental sends before Twilio/Telnyx creds are wired.
 *
 * TODO(stretch:sms.send.real): swap for TwilioMessagingProvider under
 * `messaging` capability.
 */
export const noopMessagingProvider: MessagingProvider = {
  name: "noop",
  supportsSms: false,
  supportsMms: false,
  async send(input: SendMessageInput): Promise<SendMessageResult> {
    console.info("[messaging:noop] would-send", {
      to: input.to,
      bodyPreview: input.body.slice(0, 80),
    });
    return {
      ok: true,
      messageId: null,
      provider: "noop",
      status: "queued",
    };
  },
  async healthCheck() {
    return { ok: true, checkedAt: new Date().toISOString(), message: "noop" };
  },
};
