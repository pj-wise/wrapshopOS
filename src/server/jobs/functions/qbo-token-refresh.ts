import "server-only";

import { inngest } from "../client";
import { prisma } from "@/server/db";
import { getQuickBooksClient } from "@/server/integrations/quickbooks/client";

/**
 * qbo.token.refresh — runs every 30 minutes. For every connected AccountingConnection
 * whose access token expires within the next hour, we `getCompanyInfo()` which
 * triggers the internal refresh-on-401 path if needed. This proactively keeps
 * tokens fresh so a random user action doesn't eat the refresh latency.
 */
export const qboTokenRefresh = inngest.createFunction(
  {
    id: "qbo.token.refresh",
    name: "Refresh QBO access tokens near expiry",
    retries: 1,
  },
  [
    { event: "qbo.token.refresh" },
    { cron: "*/30 * * * *" },
  ],
  async ({ step }) => {
    const cutoff = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    const conns = await step.run("list-connections", async () =>
      prisma.accountingConnection.findMany({
        where: {
          provider: "quickbooks",
          status: "connected",
          accessExpiresAt: { lt: cutoff },
        },
        select: { id: true, organizationId: true },
      }),
    );

    const results: Array<{ orgId: string; ok: boolean; error?: string }> = [];
    for (const c of conns) {
      const res = await step.run(`refresh:${c.id}`, async () => {
        try {
          const client = await getQuickBooksClient(c.organizationId);
          await client.getCompanyInfo(); // triggers refresh if needed
          return { orgId: c.organizationId, ok: true };
        } catch (err) {
          return {
            orgId: c.organizationId,
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      });
      results.push(res);
    }
    return { checked: conns.length, results };
  },
);
