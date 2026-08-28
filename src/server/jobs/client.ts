import "server-only";

import { EventSchemas, Inngest } from "inngest";
import type { z } from "zod";

/**
 * Inngest event schemas. Each job function declares which event it responds to,
 * and Inngest gives us typed payloads end-to-end.
 *
 * When we add a new job, define its event here first so `inngest.send({ name: "..." })`
 * is type-safe.
 */

// ----- event payload types -----

type EmailSendEvent = {
  data: {
    orgId: string;
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
    /** Optional idempotency key — dedupe repeats of the same event within 24h. */
    idempotencyKey?: string;
  };
};

type ImageProcessEvent = {
  data: {
    orgId: string;
    fileId: string;
    storagePath: string;
    mimeType: string;
  };
};

type IntegrationHealthCheckEvent = {
  data: {
    trigger: "cron" | "manual";
  };
};

type QuoteApprovedEvent = {
  data: {
    orgId: string;
    quoteId: string;
    customerId: string;
  };
};

type JobDeliveredEvent = {
  data: {
    orgId: string;
    jobId: string;
    customerId: string;
    /** When true, downstream handlers should send the "job complete +
     * balance-due" email. False = silent stage flip. */
    notifyCustomer?: boolean;
  };
};

type QboSyncInvoiceEvent = {
  data: { orgId: string; invoiceId: string };
};

type QboWebhookReceivedEvent = {
  data: { orgId: string; webhookEventId: string };
};

type QboTokenRefreshEvent = {
  data: { trigger: "cron" | "manual" };
};

export type WrapShopEvents = {
  "email.send": EmailSendEvent;
  "image.process": ImageProcessEvent;
  "integration.health_check": IntegrationHealthCheckEvent;
  "quote.approved": QuoteApprovedEvent;
  "job.delivered": JobDeliveredEvent;
  "qbo.sync.invoice": QboSyncInvoiceEvent;
  "qbo.webhook.received": QboWebhookReceivedEvent;
  "qbo.token.refresh": QboTokenRefreshEvent;
};

// Small helper for schema-checked payload types (used by consumers).
export type EventPayload<K extends keyof WrapShopEvents> = WrapShopEvents[K]["data"];

/**
 * The singleton Inngest client.
 *
 * In dev, `pnpm dlx inngest-cli@latest dev` runs a local dashboard at
 * http://localhost:8288 that auto-discovers our /api/inngest endpoint.
 * We force `isDev: true` when NODE_ENV !== "production" so the SDK never
 * tries to hit the Inngest Cloud API without an event key — otherwise
 * events fail with `401 Event key not found`.
 *
 * In prod, set INNGEST_EVENT_KEY + INNGEST_SIGNING_KEY and this flag flips
 * back to production mode automatically.
 */
const IS_DEV = process.env.NODE_ENV !== "production";
export const inngest = new Inngest({
  id: "wrapshop-os",
  schemas: new EventSchemas().fromRecord<WrapShopEvents>(),
  isDev: IS_DEV,
});

/**
 * Dev-only tolerance: if the local Inngest Dev Server isn't running, sends
 * blow up with `TypeError: fetch failed` (ECONNREFUSED). That would fail the
 * host mutation — e.g. a shop can't send a quote just because Inngest isn't
 * up locally. In dev we log + swallow; in prod we still throw so real
 * outages get surfaced.
 *
 * Applied by wrapping the client's `send` method so every call site
 * (`inngest.send(...)`) picks up the safety net automatically.
 */
if (IS_DEV) {
  const originalSend = inngest.send.bind(inngest);
  // Cast is safe: we preserve the signature, only widen error semantics.
  inngest.send = (async (...args: Parameters<typeof originalSend>) => {
    try {
      return await originalSend(...args);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        "[inngest] dev send failed (Dev Server offline? Run `pnpm dlx inngest-cli@latest dev`):",
        msg,
      );
      return { ids: [] as string[] };
    }
  }) as typeof inngest.send;
}

// tiny helper so we don't have to import `z` in job files that don't use it
export type _z = z.ZodTypeAny;
