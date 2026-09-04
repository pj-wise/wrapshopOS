import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createTRPCRouter,
  orgProcedure,
  requirePermission,
} from "../init";
import { recordTimelineEvent } from "@/server/audit/timeline";

/** Portal-token generator — mirrors the shape used in quotes.ts. */
function generatePortalToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

const materialTypeSchema = z.enum(["PPF", "Vinyl Wrap", "Custom Print"]);

const calculatorSnapshotSchema = z.object({
  vehicle: z.object({
    year: z.number().int().min(0).max(2100),
    make: z.string().max(50),
    model: z.string().max(80),
    totalSquareFootage: z.number().min(0).max(10_000),
  }),
  materialType: materialTypeSchema,
  pricePerSqFt: z.number().min(0),
  specialtyLaminate: z.boolean(),
  complexVehicle: z.boolean(),
  estimatedHours: z.number().min(0),
  hourlyRate: z.number().min(0),
  laborPricingMode: z.enum(["hourly", "perDay"]),
  laborCostPerDay: z.number().min(0),
  overheadPercentage: z.number().min(0).max(2),
  wasteFactor: z.number().min(0).max(2),
  marginMultiplier: z.number().min(1).max(10),
  suggestedPriceCents: z.number().int().min(0),
  totalCostCents: z.number().int().min(0),
  profitCents: z.number().int().min(0),
});

/**
 * Bridges the pricing-calculator into the existing Quote pipeline. Persists
 * as a Draft quote so it flows into the standard quote → job → invoice flow
 * without a parallel schema.
 *
 * The calculator snapshot is stored on the Quote row itself (via `internalNotes`
 * as a JSON blob prefix) so we can round-trip back into the calculator UI
 * later. Cheap MVP; migrate to a dedicated JSONB column if we start relying
 * on it programmatically.
 */
export const pricingCalculatorRouter = createTRPCRouter({
  /**
   * Convert a calculator snapshot into a Draft quote for a specific customer.
   * One aggregated line item that captures the calculator output verbatim.
   */
  saveAsQuote: orgProcedure
    .use(requirePermission("quotes:write"))
    .meta({
      audit: { entity: "quote", action: "create_from_calculator" },
    })
    .input(
      z.object({
        customerId: z.string().uuid(),
        vehicleId: z.string().uuid().nullable().optional(),
        snapshot: calculatorSnapshotSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { customerId, vehicleId, snapshot } = input;

      const customer = await ctx.db.customer.findFirst({
        where: { id: customerId, deletedAt: null },
        select: { id: true, name: true },
      });
      if (!customer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found." });
      }

      const vehicleLabel = snapshot.vehicle.make
        ? [snapshot.vehicle.year, snapshot.vehicle.make, snapshot.vehicle.model]
            .filter(Boolean)
            .join(" ")
        : "Custom vehicle";
      const description = `${snapshot.materialType} — ${vehicleLabel} — ${snapshot.vehicle.totalSquareFootage} sqft`;

      const last = await ctx.db.quote.findFirst({
        orderBy: { number: "desc" },
        select: { number: true },
      });
      const nextNumber = (last?.number ?? 0) + 1;

      // Round the cost tallies for the ledger.
      const totalCents = snapshot.suggestedPriceCents;

      // Store the calculator snapshot inside internalNotes for future
      // round-tripping (edit-in-calculator button later).
      const snapshotJson = JSON.stringify({
        source: "pricing_calculator",
        snapshot,
      });

      const quote = await ctx.db.quote.create({
        data: {
          organizationId: ctx.session.organizationId,
          customerId: customer.id,
          vehicleId: vehicleId ?? null,
          number: nextNumber,
          status: "draft",
          currency: "USD",
          taxRateBps: 0,
          depositCents: 0,
          depositPercent: 0,
          subtotalCents: totalCents,
          discountCents: 0,
          taxCents: 0,
          totalCents,
          internalNotes: snapshotJson,
          portalToken: generatePortalToken(),
          createdByUserId: ctx.session.userId,
          items: {
            create: [
              {
                organizationId: ctx.session.organizationId,
                description,
                quantity: snapshot.vehicle.totalSquareFootage || 1,
                unit: snapshot.vehicle.totalSquareFootage > 0 ? "sqft" : "each",
                unitPriceCents:
                  snapshot.vehicle.totalSquareFootage > 0
                    ? Math.round(totalCents / snapshot.vehicle.totalSquareFootage)
                    : totalCents,
                discountCents: 0,
                totalCents,
                taxable: true,
                isUpsell: false,
                sortOrder: 0,
              },
            ],
          },
        },
      });

      await recordTimelineEvent(ctx.session.organizationId, {
        entityType: "customer",
        entityId: customer.id,
        kind: "quote.created",
        actorUserId: ctx.session.userId,
        data: {
          quoteId: quote.id,
          quoteNumber: quote.number,
          source: "pricing_calculator",
          totalCents,
        },
      });

      return { quoteId: quote.id, quoteNumber: quote.number };
    }),

  /**
   * Recent estimates created via the calculator, for the "My Estimates" widget
   * on the in-app calculator page. Filters on the internalNotes marker.
   */
  recentEstimates: orgProcedure
    .use(requirePermission("quotes:read"))
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(50).default(10),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.quote.findMany({
        where: {
          deletedAt: null,
          internalNotes: { contains: '"source":"pricing_calculator"' },
        },
        include: {
          customer: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: input?.limit ?? 10,
      });
      return { items: rows };
    }),

  /**
   * Analytics: sum + avg + count of calculator-created quotes over a window.
   * Powers the Shop-tier gated widget.
   */
  analytics: orgProcedure
    .use(requirePermission("reports:read"))
    .input(
      z
        .object({
          days: z.number().int().min(1).max(365).default(30),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const days = input?.days ?? 30;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const rows = await ctx.db.quote.findMany({
        where: {
          deletedAt: null,
          createdAt: { gte: since },
          internalNotes: { contains: '"source":"pricing_calculator"' },
        },
        select: { totalCents: true, internalNotes: true, createdAt: true },
      });

      const totalValueCents = rows.reduce((s, r) => s + r.totalCents, 0);
      const count = rows.length;
      const avgValueCents = count > 0 ? Math.round(totalValueCents / count) : 0;

      // Derive per-material breakdown from the JSON snapshot embedded in
      // internalNotes. Fault-tolerant — bad rows just get skipped.
      const byMaterial: Record<string, { count: number; totalCents: number }> = {};
      for (const row of rows) {
        try {
          const parsed = JSON.parse(row.internalNotes ?? "{}") as {
            snapshot?: { materialType?: string };
          };
          const mt = parsed.snapshot?.materialType ?? "Unknown";
          if (!byMaterial[mt]) byMaterial[mt] = { count: 0, totalCents: 0 };
          byMaterial[mt].count += 1;
          byMaterial[mt].totalCents += row.totalCents;
        } catch {
          // ignore malformed rows
        }
      }

      return {
        days,
        count,
        totalValueCents,
        avgValueCents,
        byMaterial,
      };
    }),
});
