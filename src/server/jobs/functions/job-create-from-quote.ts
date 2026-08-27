import "server-only";

import { inngest } from "../client";
import { materializeJobFromQuote } from "@/server/services/materialize-job-from-quote";

/**
 * job.create_from_quote — consumes `quote.approved` events and materializes
 * a Job in the production pipeline via the shared `materializeJobFromQuote`
 * helper.
 *
 * The portal.approve mutation now calls the same helper inline so the Job
 * shows up in the "Pending Scheduling" panel immediately (no Inngest hop
 * required). This function stays wired so external `quote.approved` events
 * (backfills, admin tools) still result in a Job — the helper's idempotency
 * check keeps the concurrent case safe.
 */
export const createJobFromQuote = inngest.createFunction(
  {
    id: "job.create_from_quote",
    name: "Create Job from approved Quote",
    retries: 3,
  },
  { event: "quote.approved" },
  async ({ event, step }) => {
    const { orgId, quoteId } = event.data;
    return await step.run("create-job", async () => {
      const result = await materializeJobFromQuote(orgId, quoteId);
      if (!result.created) {
        return { skipped: true, reason: "job-exists", jobId: result.jobId };
      }
      return { jobId: result.jobId, number: result.number };
    });
  },
);
