import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { decideQuoteInput } from "@/lib/schemas/quotes";
import { prisma } from "@/server/db";
import { recordTimelineEvent } from "@/server/audit/timeline";
import { inngest } from "@/server/jobs/client";
import { materializeJobFromQuote } from "@/server/services/materialize-job-from-quote";
import { createTRPCRouter, publicProcedure } from "../init";

/**
 * Portal router — PUBLIC procedures accessed via magic-link token. No
 * session required, tenant scoping happens by looking up the Quote by its
 * unique `portalToken`. Uses bare `prisma` (not `dbFor`) because we don't
 * have an org context yet — the token itself proves org membership.
 *
 * All portal reads/writes take a `token` and never accept an org/customer id
 * directly.
 */
export const portalRouter = createTRPCRouter({
  getQuote: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const quote = await prisma.quote.findFirst({
        where: { portalToken: input.token, deletedAt: null },
        include: {
          items: { orderBy: { sortOrder: "asc" } },
          customer: { select: { name: true, email: true, phone: true } },
          organization: { select: { id: true, name: true, slug: true } },
        },
      });
      if (!quote) throw new TRPCError({ code: "NOT_FOUND" });
      if (quote.status === "revoked") {
        throw new TRPCError({ code: "FORBIDDEN", message: "This quote is no longer active." });
      }

      // Log a view (fire and forget — a single row per open is fine for MVP).
      const ua = ctx.headers.get("user-agent") ?? undefined;
      const ip = (ctx.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || undefined;
      prisma.quoteView
        .create({
          data: {
            quoteId: quote.id,
            organizationId: quote.organizationId,
            ip: ip ?? null,
            userAgent: ua ?? null,
          },
        })
        .catch((err) => console.error("[portal] view log failed", err));

      // Mark first-view.
      if (!quote.viewedAt) {
        await prisma.quote.update({
          where: { id: quote.id },
          data: { viewedAt: new Date(), status: quote.status === "sent" ? "viewed" : quote.status },
        });
        recordTimelineEvent(quote.organizationId, {
          entityType: "customer",
          entityId: quote.customerId,
          kind: "quote.viewed",
          data: { quoteId: quote.id, number: quote.number },
        });
      }

      // Never expose internal notes to the portal.
      const { internalNotes: _internalNotes, ...safe } = quote;
      return safe;
    }),

  decideQuote: publicProcedure
    .input(decideQuoteInput)
    .mutation(async ({ input, ctx }) => {
      const quote = await prisma.quote.findFirst({
        where: { portalToken: input.token, deletedAt: null },
        include: { items: true },
      });
      if (!quote) throw new TRPCError({ code: "NOT_FOUND" });
      if (["approved", "declined", "revoked"].includes(quote.status)) {
        throw new TRPCError({ code: "CONFLICT", message: `Quote already ${quote.status}.` });
      }

      const ua = ctx.headers.get("user-agent") ?? undefined;
      const ip = (ctx.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || undefined;

      if (input.action === "decline") {
        const updated = await prisma.quote.update({
          where: { id: quote.id },
          data: {
            status: "declined",
            declinedAt: new Date(),
            declinedReason: input.declinedReason ?? null,
          },
        });
        recordTimelineEvent(quote.organizationId, {
          entityType: "customer",
          entityId: quote.customerId,
          kind: "quote.declined",
          data: { quoteId: quote.id, reason: input.declinedReason ?? null },
        });
        return { ok: true, status: updated.status as "declined" };
      }

      // Approve path — require a typed name (basic e-sign) + terms acceptance.
      if (!input.signatureName || input.signatureName.trim().length < 2) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Type your full name to sign.",
        });
      }
      if (!input.acceptedTerms) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Please accept the terms." });
      }

      const updated = await prisma.$transaction(async (tx) => {
        // Mark accepted upsells (persist per-line customer decision).
        const upsellIds = new Set(input.acceptedUpsells);
        for (const item of quote.items.filter((i) => i.isUpsell)) {
          await tx.quoteLineItem.update({
            where: { id: item.id },
            data: { upsellAccepted: upsellIds.has(item.id) },
          });
        }
        return tx.quote.update({
          where: { id: quote.id },
          data: {
            status: "approved",
            approvedAt: new Date(),
            signatureName: input.signatureName ?? null,
            signatureIp: ip ?? null,
            signatureUserAgent: ua ?? null,
            acceptedTermsAt: new Date(),
          },
        });
      });

      // Materialize the Job synchronously so it shows up in the shop's
      // "Pending Scheduling" list on the next refetch — no dependency on
      // the Inngest Dev Server being up. The Inngest event still fires so
      // downstream side-effects (email + audit ledger) run, and the
      // `job.create_from_quote` handler no-ops thanks to the helper's
      // per-quoteId idempotency check.
      try {
        await materializeJobFromQuote(quote.organizationId, quote.id);
      } catch (err) {
        console.error("[portal] materializeJobFromQuote failed", err);
      }
      inngest
        .send({
          name: "quote.approved",
          data: {
            orgId: quote.organizationId,
            quoteId: quote.id,
            customerId: quote.customerId,
          },
        })
        .catch((err) => console.error("[portal] inngest send failed", err));

      await Promise.all([
        recordTimelineEvent(quote.organizationId, {
          entityType: "customer",
          entityId: quote.customerId,
          kind: "quote.approved",
          data: { quoteId: quote.id, signedBy: input.signatureName },
        }),
      ]);

      return { ok: true, status: updated.status as "approved" };
    }),
});
