import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "./db";

/**
 * Tenant-scoped Prisma client. **The single most important safety file in the app.**
 *
 * Usage:
 *   const db = dbFor(orgId);
 *   const customers = await db.customer.findMany();  // organizationId auto-injected
 *
 * Guarantees:
 *   1. `where` clauses on findMany/findFirst/count/updateMany/deleteMany get
 *      `organizationId = orgId` merged in automatically.
 *   2. `create` / `createMany` payloads must include `organizationId` — if
 *      omitted, we inject it; if supplied and mismatched, we throw.
 *   3. Same for `upsert.create`.
 *
 * Models WITHOUT `organizationId` (User, Permission, RolePermission, WebhookEvent
 * pre-processing) are listed in NON_TENANT_MODELS and bypass injection.
 *
 * ---
 *
 * ARCHITECTURAL NOTE — RLS interaction
 *
 * The app connects with the Supabase service-role key, which bypasses RLS by
 * design (standard Supabase behavior). Primary tenant isolation is therefore
 * the app-layer where-injection you're reading. The RLS `tenant_isolation`
 * policies in prisma/sql/rls-phase1.sql exist as defense-in-depth against
 * direct-DB access (Supabase Studio, psql, an accidental anon-key session).
 *
 * A previous version of this file wrapped every operation in a $transaction
 * that ran `SET LOCAL app.current_org = <orgId>` so RLS would apply to service-
 * role queries too — but the wrapped `query(args)` call runs on the extended
 * client's own connection (not the transaction's), so the session var never
 * reached the actual query AND we paid transaction overhead on every op that
 * eventually caused 5s Prisma interactive-transaction timeouts on Supabase's
 * pooler. The wrapper is removed.
 *
 * If we ever need RLS to genuinely apply to app queries (e.g. to allow
 * service-role code to safely execute untrusted SQL), the correct pattern is
 * to use `$transaction` with `tx.$executeRaw` to SET LOCAL AND run the actual
 * work through `tx`, not the extended client. That's a Phase-9 hardening item.
 *
 * If you catch yourself needing bare `prisma`, ask why. The only legitimate
 * callers live in `src/server/auth/*` (identity lookup before org is known)
 * and webhook handlers.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Models without an organizationId column — do NOT inject.
const NON_TENANT_MODELS = new Set([
  "User",
  "Permission",
  "RolePermission",
  // WebhookEvent may be null-orgId before processing — allow bare access.
  "WebhookEvent",
]);

// Query methods where we inject a `where: { organizationId }` filter.
const WHERE_METHODS = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "findUnique",
  "findUniqueOrThrow",
  "count",
  "aggregate",
  "groupBy",
  "updateMany",
  "deleteMany",
]);

// Methods where the payload's `data` MUST include organizationId.
const CREATE_METHODS = new Set(["create", "createMany", "upsert"]);

function assertUuid(orgId: string): void {
  if (!UUID_RE.test(orgId)) {
    throw new Error(`dbFor(orgId): "${orgId}" is not a UUID`);
  }
}

export type ScopedDb = ReturnType<typeof buildScopedClient>;

function buildScopedClient(orgId: string) {
  assertUuid(orgId);

  return prisma.$extends({
    name: "tenant-scope",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const isTenant = model && !NON_TENANT_MODELS.has(model);

          if (isTenant) {
            if (WHERE_METHODS.has(operation)) {
              const a = (args ?? {}) as { where?: Record<string, unknown> };
              a.where = { ...(a.where ?? {}), organizationId: orgId };
            }

            if (CREATE_METHODS.has(operation)) {
              const a = args as {
                data?: Record<string, unknown> | Array<Record<string, unknown>>;
                create?: Record<string, unknown>;
              };
              if (a.data) {
                if (Array.isArray(a.data)) {
                  for (const row of a.data) {
                    if (!("organizationId" in row)) row.organizationId = orgId;
                    else if (row.organizationId !== orgId) {
                      throw new Error(
                        `dbFor(${orgId}): create attempted with mismatched organizationId=${row.organizationId}`,
                      );
                    }
                  }
                } else {
                  if (!("organizationId" in a.data)) a.data.organizationId = orgId;
                  else if (a.data.organizationId !== orgId) {
                    throw new Error(
                      `dbFor(${orgId}): create attempted with mismatched organizationId=${a.data.organizationId}`,
                    );
                  }
                }
              }
              if (a.create && !("organizationId" in a.create)) {
                a.create.organizationId = orgId;
              }
            }
          }

          return query(args);
        },
      },
    },
  });
}

/**
 * The primary API surface for tenant-scoped DB access.
 * Pass an org UUID; you get back a Prisma client that transparently scopes
 * every query to that org (and errors on cross-org writes).
 */
export function dbFor(orgId: string): ReturnType<typeof buildScopedClient> {
  return buildScopedClient(orgId);
}

/**
 * Shortcut for tRPC / route handlers where `ctx.orgId` is populated.
 */
export function dbForCtx(ctx: { orgId: string }): ReturnType<typeof buildScopedClient> {
  return dbFor(ctx.orgId);
}

/**
 * Escape hatch for admin operations that legitimately span orgs
 * (health checks, cron jobs, super-admin). Callers MUST justify use.
 * Bypasses RLS via service role.
 */
export function dbCrossOrgAdmin(): typeof prisma {
  return prisma;
}

// Re-export Prisma namespace for types.
export { Prisma };
