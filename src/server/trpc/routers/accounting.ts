import "server-only";

import { z } from "zod";

import {
  createTRPCRouter,
  orgProcedure,
  requirePermission,
} from "../init";
import { prisma } from "@/server/db";
import { isQboConfigured } from "@/server/integrations/quickbooks/oauth";

/**
 * Accounting router — QBO-only for MVP. Extended with xero/wave later without
 * changing consumers (they read `.provider` from the response).
 */
export const accountingRouter = createTRPCRouter({
  status: orgProcedure
    .use(requirePermission("admin:integrations"))
    .query(async ({ ctx }) => {
      const conn = await prisma.accountingConnection.findFirst({
        where: {
          organizationId: ctx.session.organizationId,
          provider: "quickbooks",
        },
      });
      return {
        envConfigured: isQboConfigured(),
        provider: "quickbooks" as const,
        connected: !!conn && conn.status === "connected",
        status: conn?.status ?? "disconnected",
        realmId: conn?.realmId ?? null,
        companyName: conn?.companyName ?? null,
        environment: conn?.environment ?? null,
        lastRefreshedAt: conn?.lastRefreshedAt ?? null,
        lastRefreshError: conn?.lastRefreshError ?? null,
        accessExpiresAt: conn?.accessExpiresAt ?? null,
      };
    }),

  disconnect: orgProcedure
    .use(requirePermission("admin:integrations"))
    .meta({ audit: { entity: "accounting_connection", action: "disconnect" } })
    .input(z.object({ provider: z.literal("quickbooks").default("quickbooks") }).optional())
    .mutation(async ({ ctx }) => {
      const conn = await prisma.accountingConnection.findFirst({
        where: {
          organizationId: ctx.session.organizationId,
          provider: "quickbooks",
        },
      });
      if (!conn) return { ok: true };
      await prisma.accountingConnection.update({
        where: { id: conn.id },
        data: { status: "disconnected" },
      });
      return { ok: true };
    }),
});
