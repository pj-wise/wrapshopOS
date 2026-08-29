import "server-only";

import { inngest } from "../client";
import { prisma } from "@/server/db";
import { renderInvoiceEmail } from "@/server/services/invoice-email";
import { recordTimelineEvent } from "@/server/audit/timeline";

/**
 * invoice.email.send — render the invoice notification and hand it off to
 * `email.send` for actual delivery. Split into two Inngest events so the
 * DEV_EMAIL_OVERRIDE guard (in `email.send`) applies uniformly no matter
 * which flow triggers a customer email.
 *
 * Records `invoice.emailed` on the customer's timeline with the messageId
 * for auditability.
 */
export const invoiceEmailSend = inngest.createFunction(
  {
    id: "invoice.email.send",
    name: "Send invoice notification email",
    retries: 3,
  },
  { event: "invoice.email.send" },
  async ({ event, step }) => {
    const { orgId, invoiceId, kind } = event.data;

    const rendered = await step.run("render", async () => {
      return renderInvoiceEmail(orgId, invoiceId, kind);
    });
    if (!rendered) {
      return { skipped: true, reason: "invoice-not-found-or-no-email" };
    }

    await step.sendEvent("dispatch-email-send", {
      name: "email.send",
      data: {
        orgId,
        to: rendered.to,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        idempotencyKey: `invoice-email:${invoiceId}:${kind}`,
      },
    });

    await step.run("record-timeline", async () => {
      const inv = await prisma.invoice.findFirst({
        where: { id: invoiceId, organizationId: orgId },
        select: { customerId: true, number: true },
      });
      if (!inv) return;
      await recordTimelineEvent(orgId, {
        entityType: "customer",
        entityId: inv.customerId,
        kind: "invoice.emailed",
        data: {
          invoiceId,
          invoiceNumber: inv.number,
          to: rendered.to,
          kind,
          hasPayLink: !!rendered.qboPayLink,
        },
      });
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: { sentAt: new Date() },
      });
    });

    return {
      queued: true,
      to: rendered.to,
      invoiceNumber: rendered.invoiceNumber,
      kind,
    };
  },
);
