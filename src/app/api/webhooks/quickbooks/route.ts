import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/env";
import { prisma } from "@/server/db";
import { verifyWebhookSignature } from "@/server/integrations/quickbooks/client";
import { inngest } from "@/server/jobs/client";

/**
 * QBO webhook receiver.
 *
 * Verifies `intuit-signature` HMAC (SHA-256 base64 of raw body, using
 * `QBO_WEBHOOK_VERIFIER`). Persists an idempotency row into WebhookEvent
 * and enqueues `qbo.webhook.received` for async processing. Never blocks
 * on downstream sync work — Intuit expects a fast 200.
 *
 * ASSUMPTION (plan §5): header name + algo. Verify against a live sandbox
 * webhook before Phase 8 go-live.
 */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  const signature = request.headers.get("intuit-signature");
  if (!env.QBO_WEBHOOK_VERIFIER) {
    return NextResponse.json({ error: "webhook_not_configured" }, { status: 501 });
  }
  if (!signature) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  const ok = verifyWebhookSignature(raw, signature, env.QBO_WEBHOOK_VERIFIER);
  if (!ok) {
    return NextResponse.json({ error: "bad_signature" }, { status: 401 });
  }

  let payload: {
    eventNotifications?: Array<{
      realmId: string;
      dataChangeEvent?: {
        entities?: Array<{
          name: string;
          id: string;
          operation: string;
          lastUpdated: string;
        }>;
      };
    }>;
  };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  // Idempotency: hash the raw body as the external id. Intuit doesn't provide a
  // dedicated id; timestamp-based dedupe on eventNotifications works too.
  const externalId = await hashBody(raw);
  const existing = await prisma.webhookEvent.findFirst({
    where: { source: "quickbooks", externalId },
  });
  if (existing?.processedAt) {
    return NextResponse.json({ ok: true, deduped: true });
  }

  // Try to map realm → org. Intuit sends realmId per notification block.
  const firstRealm = payload.eventNotifications?.[0]?.realmId ?? null;
  const conn = firstRealm
    ? await prisma.accountingConnection.findFirst({
        where: { realmId: firstRealm, provider: "quickbooks" },
        select: { organizationId: true },
      })
    : null;

  const row = existing
    ? await prisma.webhookEvent.update({
        where: { id: existing.id },
        data: { payload: payload as never, organizationId: conn?.organizationId ?? null },
      })
    : await prisma.webhookEvent.create({
        data: {
          source: "quickbooks",
          externalId,
          payload: payload as never,
          organizationId: conn?.organizationId ?? null,
        },
      });

  if (conn?.organizationId) {
    await inngest.send({
      name: "qbo.webhook.received",
      data: { orgId: conn.organizationId, webhookEventId: row.id },
    });
  }

  return NextResponse.json({ ok: true });
}

async function hashBody(raw: string): Promise<string> {
  const crypto = await import("node:crypto");
  return crypto.createHash("sha256").update(raw).digest("hex");
}
