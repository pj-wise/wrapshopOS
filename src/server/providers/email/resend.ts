import "server-only";

import type { EmailProvider, SendEmailInput, SendEmailResult } from "../types";

/**
 * Resend-backed EmailProvider. Uses their REST API directly (no SDK) to avoid
 * adding a Node-only dep for a single fetch call.
 *
 * When RESEND_API_KEY is missing, the noop email provider is used instead —
 * resolved at the registry level. This factory throws if called without a key.
 */

const RESEND_URL = "https://api.resend.com/emails";

export function createResendProvider(apiKey: string, defaultFrom: string): EmailProvider {
  if (!apiKey) throw new Error("createResendProvider: apiKey is required");

  return {
    name: "resend",

    async send(input: SendEmailInput): Promise<SendEmailResult> {
      const body = {
        from: input.from ?? defaultFrom,
        to: Array.isArray(input.to) ? input.to : [input.to],
        cc: input.cc && (Array.isArray(input.cc) ? input.cc : [input.cc]),
        bcc: input.bcc && (Array.isArray(input.bcc) ? input.bcc : [input.bcc]),
        reply_to: input.replyTo,
        subject: input.subject,
        html: input.html,
        text: input.text,
        headers: input.headers,
        tags: input.tags
          ? Object.entries(input.tags).map(([name, value]) => ({ name, value }))
          : undefined,
        attachments: input.attachments?.map((a) => ({
          filename: a.filename,
          content: Buffer.isBuffer(a.content)
            ? a.content.toString("base64")
            : a.content,
          content_type: a.contentType,
        })),
      };

      const res = await fetch(RESEND_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as { id?: string; message?: string };
      if (!res.ok) {
        return {
          ok: false,
          messageId: null,
          provider: "resend",
          error: data.message ?? `HTTP ${res.status}`,
        };
      }
      return {
        ok: true,
        messageId: data.id ?? null,
        provider: "resend",
      };
    },

    async healthCheck() {
      const start = Date.now();
      try {
        const res = await fetch("https://api.resend.com/domains", {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(5000),
        });
        return {
          ok: res.ok,
          latencyMs: Date.now() - start,
          message: res.ok ? undefined : `HTTP ${res.status}`,
          checkedAt: new Date().toISOString(),
        };
      } catch (err) {
        return {
          ok: false,
          latencyMs: Date.now() - start,
          message: err instanceof Error ? err.message : String(err),
          checkedAt: new Date().toISOString(),
        };
      }
    },
  };
}
