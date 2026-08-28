import "server-only";

import { TRPCError, initTRPC } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import type { TRPCContext } from "./context";
import { dbFor, type ScopedDb } from "@/server/db-scoped";
import { auditMiddleware } from "@/server/audit/middleware";
import type { PermissionKey } from "@/lib/permissions";

/**
 * tRPC v11 root. All procedures compose from here.
 *
 * Meta shape lets each procedure declare its audit intent:
 *   .meta({ audit: { entity: "quote", action: "update" } })
 * The audit middleware picks it up automatically.
 */
export type ProcedureMeta = {
  audit?: {
    entity: string;
    action: string;
  };
};

const t = initTRPC
  .context<TRPCContext>()
  .meta<ProcedureMeta>()
  .create({
    transformer: superjson,
    errorFormatter({ shape, error }) {
      return {
        ...shape,
        data: {
          ...shape.data,
          zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
        },
      };
    },
  });

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const publicProcedure = t.procedure;

/**
 * Base procedure for signed-in users. `session` is non-null after this passes.
 */
export const authedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, session: ctx.session } });
});

/**
 * Procedure for authenticated calls scoped to the current org. Adds `db`
 * (tenant-scoped Prisma) and audit middleware. Every mutation *must* start
 * from here — this is the enforcement seam.
 */
export const orgProcedure = authedProcedure
  .use(({ ctx, next }) => {
    const db: ScopedDb = dbFor(ctx.session.organizationId);
    return next({ ctx: { ...ctx, db } });
  })
  .use(auditMiddleware);

/**
 * Procedure for platform-operator ("me") calls that transcend org scope
 * — listing every org, editing an arbitrary org's tier, etc. Gated on
 * `session.isPlatformAdmin` which is env-driven (`PLATFORM_ADMIN_EMAILS`).
 * NOT the same as any org-level `admin:*` permission.
 */
export const platformAdminProcedure = authedProcedure
  .use(({ ctx, next }) => {
    if (!ctx.session.isPlatformAdmin) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Platform admin only.",
      });
    }
    return next();
  })
  .use(auditMiddleware);

/**
 * Helper: gate a procedure on one or more permissions. Composable off
 * orgProcedure — e.g. `orgProcedure.use(requirePermission("quotes:approve"))`.
 */
export function requirePermission(...keys: PermissionKey[]) {
  return t.middleware(({ ctx, next }) => {
    if (!ctx.session) throw new TRPCError({ code: "UNAUTHORIZED" });
    for (const key of keys) {
      if (!ctx.session.permissions.has(key)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Missing permission: ${key}`,
        });
      }
    }
    return next();
  });
}
