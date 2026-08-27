import "server-only";

import { prisma } from "@/server/db";
import { formatMoney } from "@/lib/money";
import { env } from "@/env";
import type { TemplateContext } from "@/lib/template-render";

/**
 * Builds the bounded context object that message templates render against.
 *
 * Callers pass any subset of (customerId, quoteId, jobId, invoiceId). We fetch
 * only what's needed to resolve `{{shop.name}}` / `{{customer.name}}` / etc.
 * Missing pieces render as `{{path}}` (unresolved) — the template author sees
 * the miss instead of shipping empty strings.
 */
export async function buildMessageContext(input: {
  organizationId: string;
  customerId?: string | null;
  quoteId?: string | null;
  jobId?: string | null;
  invoiceId?: string | null;
}): Promise<TemplateContext> {
  const [org, customer, quote, job] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { name: true, slug: true },
    }),
    input.customerId
      ? prisma.customer.findFirst({
          where: { id: input.customerId, organizationId: input.organizationId },
          select: { name: true, email: true, phone: true },
        })
      : Promise.resolve(null),
    input.quoteId
      ? prisma.quote.findFirst({
          where: { id: input.quoteId, organizationId: input.organizationId },
          select: {
            number: true,
            totalCents: true,
            depositCents: true,
            portalToken: true,
            currency: true,
          },
        })
      : Promise.resolve(null),
    input.jobId
      ? prisma.job.findFirst({
          where: { id: input.jobId, organizationId: input.organizationId },
          select: { number: true, scheduledStart: true, title: true },
        })
      : Promise.resolve(null),
  ]);

  const firstName = customer?.name?.split(/\s+/)[0] ?? null;

  return {
    shop: {
      name: org?.name ?? "",
    },
    customer: customer
      ? {
          name: customer.name,
          firstName,
          email: customer.email ?? "",
          phone: customer.phone ?? "",
        }
      : undefined,
    quote: quote
      ? {
          number: `Q-${String(quote.number).padStart(4, "0")}`,
          total: formatMoney(quote.totalCents, quote.currency),
          deposit: formatMoney(quote.depositCents, quote.currency),
          portalUrl: `${env.NEXT_PUBLIC_APP_URL}/q/${quote.portalToken}`,
        }
      : undefined,
    job: job
      ? {
          number: `J-${String(job.number).padStart(4, "0")}`,
          title: job.title ?? "",
          scheduledDate: job.scheduledStart
            ? new Date(job.scheduledStart).toLocaleDateString()
            : "",
        }
      : undefined,
  };
}
