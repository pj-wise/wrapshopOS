-- Stripe payment integration schema additions.
--
-- Invoice gets two new optional columns for the Checkout session URL + id.
-- Payment gets fields to link back to the Stripe PaymentIntent / Charge
-- when a shop receives money through Stripe.
--
-- All fields nullable so existing rows and QBO-only shops don't need
-- backfill. Schema stays additive.

ALTER TABLE "public"."invoices"
  ADD COLUMN "stripeCheckoutUrl" TEXT,
  ADD COLUMN "stripeCheckoutSessionId" TEXT;

ALTER TABLE "public"."payments"
  ADD COLUMN "stripePaymentIntentId" TEXT,
  ADD COLUMN "stripeChargeId" TEXT;

CREATE INDEX "payments_stripePaymentIntentId_idx"
  ON "public"."payments" ("stripePaymentIntentId");
