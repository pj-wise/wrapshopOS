import "server-only";

import type { MiddlewareFunction } from "@trpc/server/unstable-core-do-not-import";

import { prisma } from "@/server/db";
import type { ProcedureMeta } from "@/server/trpc/init";
import type { TRPCContext } from "@/server/trpc/context";

/**
 * Audit middleware — writes an `AuditLog` row per mutation call whose
 * procedure declares `.meta({ audit: { entity, action } })`.
 *
 * Reads (queries) are never audited by default — too noisy. Add
 * `.meta({ audit: { entity: "quote", action: "view" } })` on sensitive
 * queries if we ever need read audit trails.
 *
 * `before` / `after` diffing is done by domain code that calls
 * `recordChange(ctx, before, after)` inside the mutation. The middleware
 * only captures actor + entity metadata that's known outside of the query.
 * A future enhancement can wrap Prisma writes and compute diffs
 * automatically via the extension layer.
 */
type Params = Parameters<MiddlewareFunction<TRPCContext, ProcedureMeta, TRPCContext, unknown, unknown>>[0];

export const auditMiddleware: MiddlewareFunction<
  TRPCContext,
  ProcedureMeta,
  TRPCContext,
  unknown,
  unknown
> = async ({ ctx, next, type, meta, path, input }: Params) => {
  const result = await next();

  // Only audit successful mutations that opt in via meta.
  if (type !== "mutation") return result;
  if (!result.ok) return result;
  if (!meta?.audit) return result;
  if (!ctx.session) return result;

  const { entity, action } = meta.audit;
  const inputMeta = typeof input === "object" && input !== null
    ? { input: sanitize(input as Record<string, unknown>) }
    : { input };

  try {
    await prisma.auditLog.create({
      data: {
        organizationId: ctx.session.organizationId,
        actorUserId: ctx.session.userId,
        action,
        entityType: entity,
        entityId: extractEntityId(result.data, input) ?? path,
        after: inputMeta as never,
        ip: extractIp(ctx),
        userAgent: ctx.headers.get("user-agent") ?? undefined,
      },
    });
  } catch (err) {
    // Never fail the mutation because audit failed — just log.
    console.error("[audit] failed to write log", { path, err });
  }

  return result;
};

const SENSITIVE_KEYS = new Set([
  "password",
  "token",
  "access_token",
  "refresh_token",
  "api_key",
  "apiKey",
  "secret",
  "authorization",
]);

function sanitize(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(k)) out[k] = "[redacted]";
    else if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = sanitize(v as Record<string, unknown>);
    } else out[k] = v;
  }
  return out;
}

function extractEntityId(result: unknown, input: unknown): string | undefined {
  if (result && typeof result === "object" && "id" in result && typeof (result as { id: unknown }).id === "string") {
    return (result as { id: string }).id;
  }
  if (input && typeof input === "object" && "id" in input && typeof (input as { id: unknown }).id === "string") {
    return (input as { id: string }).id;
  }
  return undefined;
}

function extractIp(ctx: TRPCContext): string | undefined {
  const fwd = ctx.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim();
  return ctx.headers.get("x-real-ip") ?? undefined;
}
