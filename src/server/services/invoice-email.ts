import "server-only";

import { prisma } from "@/server/db";

/**
 * Renderer for the invoice notification email. Loads Invoice + Customer +
 * Organization, produces {to, subject, html, text} ready for the low-level
 * `email.send` Inngest event.
 *
 * We keep the HTML inline (no react-email dep) so this can be rendered from
 * anywhere — Inngest step, tRPC preview mutation, tests — without a JSX
 * runtime. If the layout ever gets richer, migrate to react-email.
 */

export type InvoiceEmailKind = "initial" | "balance_reminder" | "resend";

export type RenderedInvoiceEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  invoiceNumber: number;
  qboPayLink: string | null;
  amountDueCents: number;
};

export async function renderInvoiceEmail(
  orgId: string,
  invoiceId: string,
  kind: InvoiceEmailKind = "initial",
): Promise<RenderedInvoiceEmail | null> {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, organizationId: orgId, deletedAt: null },
    include: {
      customer: { select: { name: true, email: true } },
      items: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!invoice) return null;
  if (!invoice.customer.email) return null;

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true },
  });
  const shopName = org?.name ?? "your shop";

  const invoiceLabel = `INV-${String(invoice.number).padStart(4, "0")}`;
  const total = formatCents(invoice.totalCents);
  const balance = formatCents(invoice.balanceCents);
  const paid = formatCents(invoice.amountPaidCents);
  const payLink = invoice.qboPayLink ?? null;

  const subject =
    kind === "balance_reminder"
      ? `Balance due on invoice ${invoiceLabel} — ${shopName}`
      : kind === "resend"
        ? `Your invoice ${invoiceLabel} from ${shopName}`
        : `Invoice ${invoiceLabel} from ${shopName}`;

  const greeting =
    kind === "balance_reminder"
      ? `Thanks for choosing ${shopName}. Your job is complete — the remaining balance on invoice ${invoiceLabel} is ready when you are.`
      : kind === "resend"
        ? `Here's a copy of invoice ${invoiceLabel} from ${shopName}.`
        : `Thanks for approving your quote. Below is invoice ${invoiceLabel} for the work we agreed on.`;

  const rows = invoice.items
    .map(
      (li) => `
      <tr>
        <td style="padding:8px 12px;border-top:1px solid #e5e7eb;font-size:14px;">${escapeHtml(
          li.description,
        )}</td>
        <td style="padding:8px 12px;border-top:1px solid #e5e7eb;font-size:14px;text-align:right;white-space:nowrap;">${formatCents(
          li.totalCents,
        )}</td>
      </tr>`,
    )
    .join("");

  const payButton = payLink
    ? `<a href="${escapeAttr(payLink)}" style="display:inline-block;background:#0f172a;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Pay ${balance} online</a>`
    : `<div style="color:#525252;font-size:13px;">Reply to this email to arrange payment.</div>`;

  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr><td style="padding:24px 28px 8px 28px;">
          <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">${escapeHtml(shopName)}</div>
          <div style="margin-top:4px;font-size:22px;font-weight:700;">${escapeHtml(invoiceLabel)}</div>
        </td></tr>
        <tr><td style="padding:8px 28px 4px 28px;font-size:14px;line-height:1.6;color:#374151;">
          Hi ${escapeHtml(invoice.customer.name.split(" ")[0] || invoice.customer.name)},<br/>
          ${escapeHtml(greeting)}
        </td></tr>
        <tr><td style="padding:16px 28px 8px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
            ${rows}
            <tr>
              <td style="padding:12px;font-size:13px;color:#6b7280;background:#f9fafb;border-top:1px solid #e5e7eb;">Total</td>
              <td style="padding:12px;font-size:13px;text-align:right;background:#f9fafb;border-top:1px solid #e5e7eb;">${total}</td>
            </tr>
            ${
              invoice.amountPaidCents > 0
                ? `<tr>
              <td style="padding:8px 12px;font-size:13px;color:#6b7280;background:#f9fafb;">Paid to date</td>
              <td style="padding:8px 12px;font-size:13px;text-align:right;background:#f9fafb;">${paid}</td>
            </tr>`
                : ""
            }
            <tr>
              <td style="padding:12px;font-size:15px;font-weight:600;background:#f9fafb;border-top:1px solid #e5e7eb;">Balance due</td>
              <td style="padding:12px;font-size:15px;font-weight:600;text-align:right;background:#f9fafb;border-top:1px solid #e5e7eb;">${balance}</td>
            </tr>
          </table>
        </td></tr>
        <tr><td align="center" style="padding:16px 28px 24px 28px;">
          ${payButton}
        </td></tr>
        <tr><td style="padding:0 28px 24px 28px;font-size:12px;line-height:1.6;color:#9ca3af;text-align:center;">
          Questions? Just reply to this email — it goes straight to ${escapeHtml(shopName)}.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text =
    `${shopName}\n${invoiceLabel}\n\n` +
    `Hi ${invoice.customer.name},\n\n${greeting}\n\n` +
    invoice.items.map((li) => `- ${li.description}: ${formatCents(li.totalCents)}`).join("\n") +
    `\n\nTotal: ${total}` +
    (invoice.amountPaidCents > 0 ? `\nPaid: ${paid}` : "") +
    `\nBalance due: ${balance}` +
    (payLink ? `\n\nPay online: ${payLink}` : `\n\nReply to arrange payment.`);

  return {
    to: invoice.customer.email,
    subject,
    html,
    text,
    invoiceNumber: invoice.number,
    qboPayLink: payLink,
    amountDueCents: invoice.balanceCents,
  };
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
