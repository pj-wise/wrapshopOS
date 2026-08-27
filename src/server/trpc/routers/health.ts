import "server-only";

import { z } from "zod";

import { authedProcedure, createTRPCRouter, publicProcedure } from "../init";

/**
 * Trivial health + who-am-I router. Useful for smoke tests + Phase 2
 * verification without touching any real domain data yet.
 */
export const healthRouter = createTRPCRouter({
  ping: publicProcedure.input(z.object({ echo: z.string().optional() }).optional()).query(({ input }) => {
    return { ok: true as const, ts: new Date().toISOString(), echo: input?.echo ?? null };
  }),

  whoami: authedProcedure.query(({ ctx }) => {
    return {
      userId: ctx.session.userId,
      email: ctx.session.email,
      organizationId: ctx.session.organizationId,
      organizationTier: ctx.session.organizationTier,
      roleKey: ctx.session.roleKey,
      permissions: Array.from(ctx.session.permissions).sort(),
    };
  }),
});
