import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/server/db";
import { getPaymentProvider } from "@/server/providers/registry";
import { recordTimelineEvent } from "@/server/audit/timeline";

/**
 * Stripe webhook receiver.
 *
 * Every Stripe event carries an org identity via `metadata.invoiceId` (round-
 * tripped from Checkout session creation). We look up the local invoice →
 * its organizationId → resolve THAT org's PaymentProvider → verify the
 * signature with THAT org's webhook secret. Multi-tenant safe.
 *
 * Idempotency: keyed off Stripe's event id via the shared WebhookEvent
 * table. Re-delivery within Stripe's default window returns 200 without
 * re-processing.
 */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  // We need the invoiceId to know which org's Stripe config to verify against.
  // Parse the event body (without verifying yet) just enough to extract the
  // metadata. Verification happens next, against the correct org's secret.
  let payload: {
    id?: string;
    type?: string;
    data?: { object?: { metadata?: { invoiceId?: string }; payment_intent?: unknown } };
  };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const invoiceId = payload.data?.object?.metadata?.invoiceId;
  if (!invoiceId) {
    // Not every Stripe event carries our metadata; ignore quietly.
    return NextResponse.json({ ok: true, ignored: true });
  }

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId },
    select: { id: true, organizationId: true, customerId: true, number: true },
  });
  if (!invoice) {
    return NextResponse.json({ error: "invoice_not_found" }, { status: 404 });
  }

  const provider = await getPaymentProvider(invoice.organizationId);
  if (!provider) {
    return NextResponse.json({ error: "payment_provider_not_configured" }, { status: 501 });
  }

  let outcome;
  try {
    outcome = await provider.handleWebhook({ rawBody: raw, signature });
  } catch (err) {
    console.error("[stripe.webhook] signature verify failed", err);
    return NextResponse.json({ error: "bad_signature" }, { status: 401 });
  }

  // Idempotency ledger keyed on Stripe's event id.
  const eventId = payload.id ?? `${outcome.kind}:${Date.now()}`;
  const existing = await prisma.webhookEvent.findFirst({
    where: { source: "stripe", externalId: eventId },
  });
  if (existing?.processedAt) {
    return NextResponse.json({ ok: true, deduped: true });
  }

  const row = existing
    ? await prisma.webhookEvent.update({
        where: { id: existing.id },
        data: { payload: payload as never, organizationId: invoice.organizationId },
      })
    : await prisma.webhookEvent.create({
        data: {
          source: "stripe",
          externalId: eventId,
          payload: payload as never,
          organizationId: invoice.organizationId,
        },
      });

  if (outcome.kind === "checkout.completed") {
    // Fold the received amount into the local invoice + Payment ledger.
    await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.findFirst({
        where: { id: invoice.id },
      });
      if (!inv) return;

      // Avoid double-counting on Stripe's occasional re-delivery races.
      const alreadyLogged = await tx.payment.findFirst({
        where: {
          organizationId: invoice.organizationId,
          stripePaymentIntentId: outcome.paymentIntentId ?? undefined,
        },
      });
      if (alreadyLogged) return;

      await tx.payment.create({
        data: {
          organizationId: invoice.organizationId,
          invoiceId: invoice.id,
          customerId: invoice.customerId,
          amountCents: outcome.amountReceivedCents,
          method: "stripe",
          stripePaymentIntentId: outcome.paymentIntentId ?? null,
          receivedAt: new Date(),
          notes: "Stripe Checkout — automatically reconciled",
        },
      });

      const paid = inv.amountPaidCents + outcome.amountReceivedCents;
      const balance = Math.max(0, inv.totalCents - paid);
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          amountPaidCents: paid,
          balanceCents: balance,
          status: balance === 0 ? "paid" : paid > 0 ? "partial" : inv.status,
          paidAt: balance === 0 ? new Date() : inv.paidAt,
        },
      });
    });

    await recordTimelineEvent(invoice.organizationId, {
      entityType: "customer",
      entityId: invoice.customerId,
      kind: "payment.received",
      data: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
        amountCents: outcome.amountReceivedCents,
        method: "stripe",
        stripePaymentIntentId: outcome.paymentIntentId,
      },
    });
  }

  await prisma.webhookEvent.update({
    where: { id: row.id },
    data: { processedAt: new Date(), errorMsg: null },
  });

  return NextResponse.json({ ok: true, kind: outcome.kind });
}
