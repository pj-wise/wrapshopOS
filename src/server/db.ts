import "server-only";

import { PrismaClient } from "@prisma/client";

import { env } from "@/env";

/**
 * Prisma client singleton. Do NOT import this directly from routes / procedures.
 * Import `dbFor(orgId)` / `dbForCtx(ctx)` from `./db-scoped` instead.
 *
 * The only legitimate callers of `prisma` directly:
 *   - src/server/db-scoped.ts (this file's consumer)
 *   - src/server/auth (session/user lookup where org is not yet known)
 *   - src/server/integrations webhook route handlers (before org resolved)
 *   - prisma/seed.ts
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
