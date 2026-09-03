import "server-only";

import { env } from "@/env";
import type {
  MessagingProvider,
  SendMessageInput,
  SendMessageResult,
} from "../types";

/**
 * Twilio-backed MessagingProvider. Uses the REST API directly (no SDK) — one
 * fetch call, same pattern as `../email/resend.ts`.
 *
 * Factory takes a config object rather than reading env directly — the
 * provider registry (`../registry.ts`) decides at resolve time whether the
 * config came from the tenant's ExternalIntegration row or from the
 * platform's env vars, then hands the merged config down.
 *
 * Uses a Messaging Service (MG…) rather than a raw From number — Twilio's
 * Messaging Services handle sender-pool routing, A2P 10DLC compliance, and
 * per-region number selection automatically.
 *
 * Dev safety: when `NODE_ENV !== "production"` and `DEV_SMS_OVERRIDE` is set,
 * every outbound message is redirected to that number. Prevents dev
 * iteration from surprising real customers with texts. Mirrors the
 * DEV_EMAIL_OVERRIDE pattern in the email.send Inngest handler.
 */

export type TwilioProviderConfig = {
  accountSid: string;
  authToken: string;
  messagingServiceSid: string;
};

const TWILIO_API_BASE = "https://api.twilio.com/2010-04-01";

export function createTwilioProvider(
  config: TwilioProviderConfig,
): MessagingProvider {
  const { accountSid, authToken, messagingServiceSid } = config;
  if (!accountSid || !authToken || !messagingServiceSid) {
    throw new Error(
      "createTwilioProvider: accountSid, authToken, and messagingServiceSid are all required",
    );
  }

  const authHeader = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;

  return {
    name: "twilio",
    supportsSms: true,
    supportsMms: true,

    async send(input: SendMessageInput): Promise<SendMessageResult> {
      const devOverride =
        env.NODE_ENV !== "production" && env.DEV_SMS_OVERRIDE
          ? env.DEV_SMS_OVERRIDE
          : null;
      const to = devOverride ?? input.to;
      const body = devOverride
        ? `[DEV → ${input.to}] ${input.body}`
        : input.body;
      if (devOverride) {
        console.info(
          `[twilio.send] dev override: redirecting to=${input.to} → ${devOverride}`,
        );
      }

      const params = new URLSearchParams();
      params.set("MessagingServiceSid", messagingServiceSid);
      params.set("To", to);
      params.set("Body", body);
      for (const url of input.mediaUrls ?? []) {
        params.append("MediaUrl", url);
      }

      const res = await fetch(
        `${TWILIO_API_BASE}/Accounts/${accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
          body: params.toString(),
        },
      );

      const data = (await res.json().catch(() => ({}))) as {
        sid?: string;
        status?: string;
        message?: string;
        code?: number;
      };

      if (!res.ok) {
        return {
          ok: false,
          messageId: null,
          provider: "twilio",
          status: "failed",
          error: data.message ?? `HTTP ${res.status}`,
        };
      }

      const status: SendMessageResult["status"] =
        data.status === "sent" || data.status === "delivered"
          ? "sent"
          : data.status === "failed" || data.status === "undelivered"
            ? "failed"
            : "queued";

      return {
        ok: true,
        messageId: data.sid ?? null,
        provider: "twilio",
        status,
      };
    },

    async healthCheck() {
      const start = Date.now();
      try {
        const res = await fetch(
          `${TWILIO_API_BASE}/Accounts/${accountSid}.json`,
          {
            headers: { Authorization: authHeader, Accept: "application/json" },
            signal: AbortSignal.timeout(5000),
          },
        );
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
