import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, orgProcedure, publicProcedure, requirePermission } from "../init";
import { prisma } from "@/server/db";

/**
 * Review request settings live on `Organization.settings.reviews`. Small enough
 * that a dedicated table isn't warranted yet. Shape:
 *   { googleUrl?: string; yelpUrl?: string; facebookUrl?: string; manualUrl?: string; primary?: "google"|"yelp"|... }
 */
type ReviewSettings = {
  googleUrl?: string;
  yelpUrl?: string;
  facebookUrl?: string;
  manualUrl?: string;
  primary?: "google" | "yelp" | "facebook" | "manual";
};

const reviewSettingsInput = z.object({
  googleUrl: z.string().trim().url().optional().or(z.literal("").transform(() => undefined)),
  yelpUrl: z.string().trim().url().optional().or(z.literal("").transform(() => undefined)),
  facebookUrl: z.string().trim().url().optional().or(z.literal("").transform(() => undefined)),
  manualUrl: z.string().trim().url().optional().or(z.literal("").transform(() => undefined)),
  primary: z.enum(["google", "yelp", "facebook", "manual"]).optional(),
});

export const reviewsRouter = createTRPCRouter({
  getSettings: orgProcedure
    .use(requirePermission("settings:read"))
    .query(async ({ ctx }) => {
      const org = await prisma.organization.findUnique({
        where: { id: ctx.session.organizationId },
        select: { settings: true },
      });
      const raw = (org?.settings ?? {}) as Record<string, unknown>;
      return (raw.reviews ?? {}) as ReviewSettings;
    }),

  saveSettings: orgProcedure
    .use(requirePermission("settings:write"))
    .meta({ audit: { entity: "review_settings", action: "save" } })
    .input(reviewSettingsInput)
    .mutation(async ({ ctx, input }) => {
      const org = await prisma.organization.findUnique({
        where: { id: ctx.session.organizationId },
        select: { settings: true },
      });
      const current = (org?.settings ?? {}) as Record<string, unknown>;
      const next = { ...current, reviews: input };
      await prisma.organization.update({
        where: { id: ctx.session.organizationId },
        data: { settings: next as never },
      });
      return input;
    }),

  listForJob: orgProcedure
    .use(requirePermission("jobs:read"))
    .input(z.object({ jobId: z.string().uuid() }))
    .query(({ ctx, input }) =>
      ctx.db.reviewRequest.findMany({
        where: { jobId: input.jobId },
        orderBy: { queuedAt: "desc" },
      }),
    ),

  /**
   * PUBLIC: called via the outbound review-request URL redirect. Records the
   * click + bounces the browser to the actual Google/Yelp/etc URL. Token is
   * just the request id (no PII leak — id is opaque UUID).
   */
  markClicked: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const req = await prisma.reviewRequest.findUnique({ where: { id: input.id } });
      if (!req) throw new TRPCError({ code: "NOT_FOUND" });
      if (!req.clickedAt) {
        await prisma.reviewRequest.update({
          where: { id: req.id },
          data: { clickedAt: new Date() },
        });
      }
      return { url: req.url };
    }),
});
