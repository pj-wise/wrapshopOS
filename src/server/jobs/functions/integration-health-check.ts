import "server-only";

import { inngest } from "../client";
import { prisma } from "@/server/db";
import {
  getEmailProvider,
  getStorageProvider,
  getVehicleProvider,
} from "@/server/providers/registry";
import type { ProviderBase } from "@/server/providers/types";

/**
 * integration.health_check — every 15 minutes, ping every wired integration
 * per org and update ExternalIntegration.status. Also health-checks the
 * platform-default providers even if no per-org integration row exists.
 */
export const healthCheckIntegrations = inngest.createFunction(
  {
    id: "integration.health_check",
    name: "Ping all integrations and update status",
    retries: 1,
  },
  [
    { event: "integration.health_check" },
    { cron: "*/15 * * * *" },
  ],
  async ({ step }) => {
    const orgs = await step.run("list-orgs", async () =>
      prisma.organization.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true },
      }),
    );

    const results: Array<{ orgId: string; capability: string; ok: boolean; message?: string }> = [];

    for (const org of orgs) {
      // Platform-default providers we can always check even without a row:
      const checks: Array<[string, () => Promise<ProviderBase>]> = [
        ["vehicle_data", () => getVehicleProvider(org.id)],
        ["email", () => getEmailProvider(org.id)],
        ["storage", () => getStorageProvider(org.id)],
      ];

      for (const [capability, factory] of checks) {
        const health = await step.run(`health:${org.id}:${capability}`, async () => {
          const provider = await factory();
          if (!provider.healthCheck) return { ok: true, checkedAt: new Date().toISOString() };
          return provider.healthCheck();
        });

        results.push({ orgId: org.id, capability, ok: health.ok, message: health.message });

        await step.run(`persist:${org.id}:${capability}`, async () => {
          const existing = await prisma.externalIntegration.findFirst({
            where: { organizationId: org.id, capability },
          });
          const status = health.ok ? "healthy" : "degraded";
          if (existing) {
            await prisma.externalIntegration.update({
              where: { id: existing.id },
              data: {
                status,
                lastCheckedAt: new Date(),
                lastErrorAt: health.ok ? existing.lastErrorAt : new Date(),
                lastErrorMsg: health.ok ? null : health.message ?? null,
              },
            });
          }
        });
      }
    }

    return { checked: results.length, results: results.slice(0, 25) };
  },
);
