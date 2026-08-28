import "server-only";

import { inngest } from "../client";
import { materializeJobFromQuote } from "@/server/services/materialize-job-from-quote";
import { materializeInvoiceFromJob } from "@/server/services/materialize-invoice-from-job";

/**
 * job.create_from_quote — consumes `quote.approved` events and materializes
 * both the Job AND the Invoice via the shared helpers.
 *
 * The portal.approve mutation calls both helpers inline so the Job + Invoice
 * appear immediately (no Inngest hop required). This function stays wired
 * for external `quote.approved` events (backfills, admin tools). Helpers are
 * idempotent per quoteId / jobId so concurrent execution is safe.
 */
export const createJobFromQuote = inngest.createFunction(
  {
    id: "job.create_from_quote",
    name: "Create Job + Invoice from approved Quote",
    retries: 3,
  },
  { event: "quote.approved" },
  async ({ event, step }) => {
    const { orgId, quoteId } = event.data;
    const jobResult = await step.run("create-job", async () =>
      materializeJobFromQuote(orgId, quoteId),
    );
    if (!jobResult.jobId) {
      return { skipped: true, reason: "quote-not-approved" };
    }
    const invoiceResult = await step.run("create-invoice", async () =>
      materializeInvoiceFromJob(orgId, jobResult.jobId),
    );
    return {
      jobId: jobResult.jobId,
      jobCreated: jobResult.created,
      invoiceId: invoiceResult.invoiceId,
      invoiceCreated: invoiceResult.created,
    };
  },
);
