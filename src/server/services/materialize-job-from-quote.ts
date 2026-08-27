import "server-only";

import { prisma } from "@/server/db";
import { recordTimelineEvent } from "@/server/audit/timeline";

/**
 * Convert an approved Quote into a Job. Idempotent by `quoteId` — if a Job
 * already exists for the quote, we short-circuit and return the existing one.
 *
 * Called from two paths that both need this to happen ASAP:
 *   1. The portal.approve mutation (so the shop sees the newly-approved job
 *      in the Pending Scheduling list on the very next refetch, without
 *      waiting on the Inngest event loop).
 *   2. The `job.create_from_quote` Inngest function (fires on the
 *      `quote.approved` event from other paths — QA approvals, backfills,
 *      internal-approve tools).
 *
 * When both fire concurrently the idempotency check keeps us honest: only
 * one Job row is created; the second call returns the existing row.
 */
export async function materializeJobFromQuote(
  orgId: string,
  quoteId: string,
): Promise<{ jobId: string; number: number; created: boolean }> {
  const existing = await prisma.job.findFirst({
    where: { organizationId: orgId, quoteId, deletedAt: null },
    select: { id: true, number: true },
  });
  if (existing) {
    return { jobId: existing.id, number: existing.number, created: false };
  }

  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, organizationId: orgId },
  });
  if (!quote) throw new Error(`Quote ${quoteId} not found in org ${orgId}`);

  const lineItems = await prisma.quoteLineItem.findMany({
    where: { quoteId: quote.id, isUpsell: false },
    orderBy: { sortOrder: "asc" },
  });

  // Pull services + vehicle in parallel — kept as separate queries since
  // QuoteLineItem doesn't declare a Prisma relation to Service.
  const [services, vehicle] = await Promise.all([
    prisma.service.findMany({
      where: {
        organizationId: orgId,
        id: {
          in: lineItems
            .map((i) => i.serviceId)
            .filter((v): v is string => Boolean(v)),
        },
      },
      select: {
        id: true,
        categoryId: true,
        defaultLaborHours: true,
      },
    }),
    quote.vehicleId
      ? prisma.vehicle.findFirst({
          where: { id: quote.vehicleId, organizationId: orgId },
          select: { year: true, make: true, model: true },
        })
      : Promise.resolve(null),
  ]);
  const svcById = new Map(services.map((s) => [s.id, s]));

  const estimatedHours = lineItems
    .map((li) => {
      const svc = li.serviceId ? svcById.get(li.serviceId) : undefined;
      const hoursPerUnit = svc?.defaultLaborHours ? Number(svc.defaultLaborHours) : 0;
      return hoursPerUnit * Number(li.quantity ?? 1);
    })
    .reduce((a, b) => a + b, 0);

  const firstCat = lineItems.find((li) => {
    const svc = li.serviceId ? svcById.get(li.serviceId) : undefined;
    return svc?.categoryId != null;
  });
  const template = firstCat
    ? await prisma.checklistTemplate.findFirst({ where: { organizationId: orgId } })
    : null;

  const last = await prisma.job.findFirst({
    where: { organizationId: orgId },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const nextNumber = (last?.number ?? 0) + 1;

  const title =
    [vehicle?.year, vehicle?.make, vehicle?.model].filter(Boolean).join(" ") || undefined;

  const summary = lineItems.map((li) => li.description).slice(0, 6).join(" · ");

  const job = await prisma.job.create({
    data: {
      organizationId: orgId,
      quoteId: quote.id,
      customerId: quote.customerId,
      vehicleId: quote.vehicleId,
      number: nextNumber,
      // Every customer-approved quote lands in "Approved" — the shop
      // advances it to "Deposit received" (`ready`) once payment lands (or
      // right away if no deposit was required). Auto-skipping the Approved
      // stage on no-deposit quotes hid the fact that a shop still needs to
      // acknowledge/prep for the incoming work.
      status: "approved",
      title,
      summary,
      estimatedHours: estimatedHours || null,
      workOrder: {
        create: {
          organizationId: orgId,
          checklistTemplateId: template?.id ?? null,
          items: template?.itemsJson
            ? {
                createMany: {
                  data: (
                    template.itemsJson as Array<{
                      section?: string;
                      label: string;
                      requiredPhoto?: boolean;
                      requiredNote?: boolean;
                    }>
                  ).map((item, i) => ({
                    organizationId: orgId,
                    section: item.section ?? null,
                    label: item.label,
                    sortOrder: i,
                    requiredPhoto: !!item.requiredPhoto,
                    requiredNote: !!item.requiredNote,
                  })),
                },
              }
            : undefined,
        },
      },
    },
  });

  await recordTimelineEvent(orgId, {
    entityType: "customer",
    entityId: quote.customerId,
    kind: "job.created",
    data: { jobId: job.id, jobNumber: job.number, fromQuoteId: quote.id },
  });
  await recordTimelineEvent(orgId, {
    entityType: "job" as never,
    entityId: job.id,
    kind: "job.created_from_quote",
    data: { quoteId: quote.id, quoteNumber: quote.number },
  });

  return { jobId: job.id, number: job.number, created: true };
}
