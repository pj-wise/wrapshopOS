import "server-only";

import { inngest } from "../client";
import { materializeInvoiceFromJob } from "@/server/services/materialize-invoice-from-job";

/**
 * invoice.create_from_delivered_job — backstop path.
 *
 * The primary invoice-creation path is quote-approval (portal.decideQuote +
 * job.create_from_quote handler), which lets deposits attach as partial
 * Payments on the invoice as the job progresses. This handler exists only
 * for edge cases where a Job was created outside the quote-approval flow
 * (walk-in, manual admin create). Idempotent via the shared helper — if the
 * invoice already exists, this is a no-op.
 */
export const invoiceFromDeliveredJob = inngest.createFunction(
  {
    id: "invoice.create_from_delivered_job",
    name: "Auto-create Invoice when Job delivered (backstop)",
    retries: 2,
  },
  { event: "job.delivered" },
  async ({ event, step }) => {
    const { orgId, jobId } = event.data;

    return await step.run("create-invoice", async () => {
      const result = await materializeInvoiceFromJob(orgId, jobId);
      if (!result.created) {
        return { skipped: true, reason: "invoice-exists-or-job-missing", invoiceId: result.invoiceId };
      }
      return { invoiceId: result.invoiceId, number: result.number };
    });
  },
);
