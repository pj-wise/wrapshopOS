import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { deductRollInput, receiveRollInput } from "@/lib/schemas/inventory";
import { createTRPCRouter, orgProcedure, requirePermission } from "../init";
import { recordTimelineEvent } from "@/server/audit/timeline";

/**
 * inventory router — the roll ledger. `deductRoll` is called from the job
 * detail's "Materials used" widget; it opens a transaction that (a) inserts
 * an InventoryTransaction row and (b) decrements the roll's remainingLengthYd
 * in one atomic step so multiple techs deducting the same roll can't oversell.
 */
export const inventoryRouter = createTRPCRouter({
  listTransactions: orgProcedure
    .use(requirePermission("inventory:read"))
    .input(
      z
        .object({
          materialRollId: z.string().uuid().optional(),
          jobId: z.string().uuid().optional(),
          limit: z.number().int().min(1).max(200).default(100),
        })
        .optional(),
    )
    .query(({ ctx, input }) =>
      ctx.db.inventoryTransaction.findMany({
        where: {
          materialRollId: input?.materialRollId ?? undefined,
          jobId: input?.jobId ?? undefined,
        },
        include: {
          roll: {
            select: {
              id: true,
              widthIn: true,
              material: { select: { name: true, manufacturer: true } },
            },
          },
          job: { select: { id: true, number: true } },
        },
        orderBy: { performedAt: "desc" },
        take: input?.limit ?? 100,
      }),
    ),

  deductRoll: orgProcedure
    .use(requirePermission("inventory:consume"))
    .meta({ audit: { entity: "material_roll", action: "deduct" } })
    .input(deductRollInput)
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.$transaction(async (tx) => {
        const roll = await tx.materialRoll.findFirst({
          where: { id: input.materialRollId, deletedAt: null },
          include: { material: { select: { name: true } } },
        });
        if (!roll) throw new TRPCError({ code: "NOT_FOUND", message: "Roll not found." });
        if (roll.retiredAt) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Roll ${roll.material.name} is retired.`,
          });
        }
        const remaining = Number(roll.remainingLengthYd);
        if (input.lengthYd > remaining + 0.001) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Only ${remaining.toFixed(2)} yd remaining on this roll.`,
          });
        }

        // Compute cost from roll's cost/starting length (avg cost per yd).
        const perYdCents =
          Number(roll.startingLengthYd) > 0
            ? Math.round(roll.costCents / Number(roll.startingLengthYd))
            : 0;
        const costCents = Math.round(perYdCents * input.lengthYd);

        const newRemaining = Math.max(0, remaining - input.lengthYd);
        const updated = await tx.materialRoll.update({
          where: { id: roll.id },
          data: {
            remainingLengthYd: newRemaining,
            retiredAt: newRemaining <= 0 ? new Date() : null,
          },
        });

        const txn = await tx.inventoryTransaction.create({
          data: {
            organizationId: ctx.session.organizationId,
            materialRollId: roll.id,
            jobId: input.jobId ?? null,
            kind: input.kind,
            lengthYd: input.lengthYd,
            costCents,
            notes: input.notes ?? null,
            performedByUserId: ctx.session.userId,
          },
        });

        if (input.jobId) {
          await recordTimelineEvent(ctx.session.organizationId, {
            entityType: "job" as never,
            entityId: input.jobId,
            kind: "inventory.deducted",
            actorUserId: ctx.session.userId,
            data: {
              materialRollId: roll.id,
              material: roll.material.name,
              lengthYd: input.lengthYd,
              costCents,
            },
          });
        }

        return { transaction: txn, roll: updated };
      });
    }),

  receiveOntoRoll: orgProcedure
    .use(requirePermission("inventory:write"))
    .meta({ audit: { entity: "material_roll", action: "receive" } })
    .input(receiveRollInput)
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.$transaction(async (tx) => {
        const roll = await tx.materialRoll.findFirst({
          where: { id: input.materialRollId, deletedAt: null },
        });
        if (!roll) throw new TRPCError({ code: "NOT_FOUND" });
        const updated = await tx.materialRoll.update({
          where: { id: roll.id },
          data: {
            remainingLengthYd: Number(roll.remainingLengthYd) + input.lengthYd,
            retiredAt: null,
          },
        });
        const txn = await tx.inventoryTransaction.create({
          data: {
            organizationId: ctx.session.organizationId,
            materialRollId: roll.id,
            kind: "receive",
            lengthYd: input.lengthYd,
            costCents: 0,
            notes: input.notes ?? null,
            performedByUserId: ctx.session.userId,
          },
        });
        return { transaction: txn, roll: updated };
      });
    }),
});
