import "server-only";

import Stripe from "stripe";

import type {
  PaymentCheckoutSession,
  PaymentProvider,
  PaymentSessionStatus,
  PaymentWebhookOutcome,
} from "../types";

/**
 * Stripe-backed PaymentProvider.
 *
 * Per-shop API key mode (MVP) — the shop pastes their own live/test secret
 * key via the Configure dialog. No Stripe Connect Standard OAuth for now;
 * add later if we want to onboard shops into Stripe's Connect ecosystem.
 *
 * Deliberately narrow: we support Checkout for one-shot invoice payments
 * (deposits + balance due). Subscription billing for autoLuxOS ITSELF
 * (i.e. shops paying us) is out of scope for this provider — that lives
 * in a separate `src/server/subscriptions/` layer when we build it.
 */

export type StripeProviderConfig = {
  secretKey: string;
  /** Client-side publishable key, used later for Stripe Elements. Optional today. */
  publishableKey?: string;
  /** Webhook signing secret. Required for handleWebhook to work. */
  webhookSecret?: string;
};

export function createStripeProvider(config: StripeProviderConfig): PaymentProvider {
  const { secretKey, webhookSecret } = config;
  if (!secretKey) {
    throw new Error("createStripeProvider: secretKey is required");
  }

  // Stripe SDK picks its default apiVersion matching the installed package.
  // Pinning here means bumping the string whenever we upgrade stripe@X.Y.Z —
  // easier to let the SDK own that until we have a specific reason to pin.
  const stripe = new Stripe(secretKey, { typescript: true });

  return {
    name: "stripe",

    async createCheckoutSession(input) {
      const currency = (input.currency ?? "USD").toLowerCase();
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency,
              product_data: {
                name: input.description ?? `Invoice payment`,
              },
              unit_amount: input.amountCents,
            },
            quantity: 1,
          },
        ],
        customer_email: input.customerEmail,
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        // Metadata round-trips the local invoice id so the webhook handler
        // can match without a name-lookup.
        metadata: { invoiceId: input.invoiceId },
        payment_intent_data: {
          metadata: { invoiceId: input.invoiceId },
        },
      });

      if (!session.url || !session.id || !session.expires_at) {
        throw new Error("stripe.checkout.sessions.create returned an incomplete session");
      }

      return {
        externalId: session.id,
        url: session.url,
        amountCents: input.amountCents,
        currency: currency.toUpperCase(),
        invoiceId: input.invoiceId,
        expiresAt: new Date(session.expires_at * 1000).toISOString(),
      } satisfies PaymentCheckoutSession;
    },

    async getSessionStatus(externalId): Promise<PaymentSessionStatus> {
      const session = await stripe.checkout.sessions.retrieve(externalId);
      if (session.status === "complete") return "complete";
      if (session.status === "expired") return "expired";
      return "open";
    },

    async handleWebhook({ rawBody, signature }): Promise<PaymentWebhookOutcome> {
      if (!webhookSecret) {
        throw new Error(
          "stripe.handleWebhook: webhookSecret not configured; cannot verify signature",
        );
      }
      const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          const invoiceId = session.metadata?.invoiceId;
          if (!invoiceId) {
            return { kind: "ignored", eventType: event.type };
          }
          return {
            kind: "checkout.completed",
            sessionExternalId: session.id,
            invoiceId,
            amountReceivedCents: session.amount_total ?? 0,
            paymentIntentId:
              typeof session.payment_intent === "string"
                ? session.payment_intent
                : session.payment_intent?.id,
          };
        }
        case "payment_intent.succeeded": {
          const pi = event.data.object as Stripe.PaymentIntent;
          return {
            kind: "payment_intent.succeeded",
            paymentIntentId: pi.id,
            amountReceivedCents: pi.amount_received ?? 0,
          };
        }
        case "payment_intent.payment_failed": {
          const pi = event.data.object as Stripe.PaymentIntent;
          return {
            kind: "payment_intent.failed",
            paymentIntentId: pi.id,
            message: pi.last_payment_error?.message,
          };
        }
        default:
          return { kind: "ignored", eventType: event.type };
      }
    },

    async healthCheck() {
      const start = Date.now();
      try {
        await stripe.balance.retrieve();
        return {
          ok: true,
          latencyMs: Date.now() - start,
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
