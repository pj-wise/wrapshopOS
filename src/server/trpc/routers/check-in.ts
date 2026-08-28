import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import crypto from "node:crypto";

import { env } from "@/env";
import { prisma } from "@/server/db";
import {
  createTRPCRouter,
  orgProcedure,
  publicProcedure,
  requirePermission,
} from "../init";
import { featureService } from "@/server/features/service";
import { finalizeCheckIn } from "@/server/services/finalize-check-in";
import { getStorageProvider } from "@/server/providers/registry";
import { inngest } from "@/server/jobs/client";
import { recordTimelineEvent } from "@/server/audit/timeline";

const TOKEN_TTL_MINUTES = 30;
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // Match files.createUploadUrl

function generateToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

async function loadValidToken(token: string) {
  const row = await prisma.mobileCheckInToken.findUnique({
    where: { token },
    include: {
      job: {
        include: {
          customer: { select: { name: true } },
          vehicle: {
            select: { id: true, year: true, make: true, model: true, trim: true },
          },
        },
      },
    },
  });
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Unknown or expired link." });
  if (row.expiresAt.getTime() < Date.now()) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This link has expired." });
  }
  if (row.completedAt) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "This check-in is already complete.",
    });
  }
  return row;
}

/**
 * checkIn router — powers the mobile-photo hand-off + the opt-out path.
 *
 * Two audience surfaces:
 *   - `orgProcedure` for the desktop actor initiating the flow.
 *   - `publicProcedure` for the tokenized mobile route (`/m/checkin/{t}`)
 *     — the token is the auth. All public endpoints enforce token
 *     validity + expiry + org scoping internally.
 */
export const checkInRouter = createTRPCRouter({
  // ==== Desktop-side ========================================================

  /**
   * Gated on `operations.mobile_check_in` (Pro+). Mints (or reuses) a
   * MobileCheckInToken; returns the QR-ready mobile URL + TTL.
   */
  startPrep: orgProcedure
    .use(requirePermission("jobs:checkin"))
    .meta({ audit: { entity: "check_in", action: "prep_started" } })
    .input(z.object({ jobId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await featureService.require(
        {
          orgId: ctx.session.organizationId,
          orgTier: ctx.session.organizationTier,
          userId: ctx.session.userId,
        },
        "operations.mobile_check_in",
      );

      // Reuse an unconsumed, unexpired token for the same job when one
      // already exists — otherwise every re-open of the QR would spawn a
      // new row and orphan the previous QR the tech might've scanned.
      const existing = await prisma.mobileCheckInToken.findFirst({
        where: {
          organizationId: ctx.session.organizationId,
          jobId: input.jobId,
          completedAt: null,
          consumedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
      });
      const row =
        existing ??
        (await prisma.mobileCheckInToken.create({
          data: {
            organizationId: ctx.session.organizationId,
            jobId: input.jobId,
            token: generateToken(),
            expiresAt: new Date(Date.now() + TOKEN_TTL_MINUTES * 60_000),
            createdByUserId: ctx.session.userId,
          },
        }));

      await recordTimelineEvent(ctx.session.organizationId, {
        entityType: "job" as never,
        entityId: input.jobId,
        kind: "check_in.prep_started",
        actorUserId: ctx.session.userId,
        data: { tokenId: row.id },
      });

      return {
        token: row.token,
        mobileUrl: `${env.NEXT_PUBLIC_APP_URL}/m/checkin/${row.token}`,
        expiresAt: row.expiresAt,
      };
    }),

  /**
   * Polled by the desktop QR modal every few seconds. Cheap. Returns
   * `null` if the token expired or was already completed — client uses
   * that as the "session ended" signal.
   */
  prepStatus: orgProcedure
    .use(requirePermission("jobs:checkin"))
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const row = await prisma.mobileCheckInToken.findUnique({
        where: { token: input.token },
        select: {
          organizationId: true,
          jobId: true,
          consumedAt: true,
          completedAt: true,
          expiresAt: true,
        },
      });
      if (!row) return null;
      if (row.organizationId !== ctx.session.organizationId) return null;
      // Photo count is a live sum from the CheckIn row.
      const checkIn = await prisma.checkIn.findFirst({
        where: { jobId: row.jobId },
        select: { damagePhotoFileIds: true, overallPhotoFileIds: true },
      });
      const photoCount =
        (checkIn?.damagePhotoFileIds.length ?? 0) +
        (checkIn?.overallPhotoFileIds.length ?? 0);
      return {
        consumedAt: row.consumedAt,
        completedAt: row.completedAt,
        expiresAt: row.expiresAt,
        photoCount,
      };
    }),

  /**
   * Skip-photos path. Records the acknowledgement + optional reason, then
   * runs the shared `finalizeCheckIn` helper to flip the job.
   */
  optOutPhotos: orgProcedure
    .use(requirePermission("jobs:checkin"))
    .meta({ audit: { entity: "check_in", action: "opt_out_photos" } })
    .input(
      z.object({
        jobId: z.string().uuid(),
        reason: z.string().trim().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await featureService.require(
        {
          orgId: ctx.session.organizationId,
          orgTier: ctx.session.organizationTier,
          userId: ctx.session.userId,
        },
        "operations.mobile_check_in",
      );
      const res = await finalizeCheckIn(prisma, {
        jobId: input.jobId,
        organizationId: ctx.session.organizationId,
        performedByUserId: ctx.session.userId,
        reason: "opt_out",
        patch: {
          optOutOfPhotos: true,
          optOutReason: input.reason ?? null,
          optOutAcknowledgedByUserId: ctx.session.userId,
          optOutAcknowledgedAt: new Date(),
          damagePhotoFileIds: [],
          overallPhotoFileIds: [],
        },
        timelineData: { hasReason: Boolean(input.reason) },
      });
      return { id: res.checkInId };
    }),

  // ==== Mobile-side (public, tokenized) =====================================

  /**
   * Called on first mobile page load. Returns just enough for the phone UI
   * to identify the job. Side effect: stamps `consumedAt` so the desktop's
   * poll flips into "phone connected".
   */
  resolveMobileToken: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ input }) => {
      const row = await loadValidToken(input.token);
      if (!row.consumedAt) {
        await prisma.mobileCheckInToken.update({
          where: { id: row.id },
          data: { consumedAt: new Date() },
        });
      }
      const vehicle =
        row.job.vehicle &&
        [row.job.vehicle.year, row.job.vehicle.make, row.job.vehicle.model, row.job.vehicle.trim]
          .filter(Boolean)
          .join(" ");
      const checkIn = await prisma.checkIn.findFirst({
        where: { jobId: row.jobId },
        select: { damagePhotoFileIds: true, overallPhotoFileIds: true },
      });
      return {
        jobId: row.jobId,
        jobNumber: row.job.number,
        customerName: row.job.customer.name,
        vehicleSummary: vehicle || null,
        expiresAt: row.expiresAt,
        damagePhotoCount: checkIn?.damagePhotoFileIds.length ?? 0,
        overallPhotoCount: checkIn?.overallPhotoFileIds.length ?? 0,
      };
    }),

  /**
   * Public counterpart to `files.createUploadUrl`. The token gates
   * access. Storage path stays scoped to the token's org so the
   * per-org prefix check downstream still holds.
   */
  mobileCreateUploadUrl: publicProcedure
    .input(
      z.object({
        token: z.string().min(1),
        fileName: z.string().min(1).max(200),
        mimeType: z.string().min(1).max(120),
        sizeBytes: z.number().int().min(0).max(MAX_UPLOAD_BYTES),
      }),
    )
    .mutation(async ({ input }) => {
      const row = await loadValidToken(input.token);
      const storage = await getStorageProvider(row.organizationId);
      return storage.createUploadUrl({
        orgId: row.organizationId,
        category: "photo",
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
      });
    }),

  /**
   * Public counterpart to `files.finalize`. Also appends the resulting
   * fileId to the CheckIn's damage/overall array so the desktop's poll
   * sees the count go up.
   */
  mobileFinalizeUpload: publicProcedure
    .input(
      z.object({
        token: z.string().min(1),
        storagePath: z.string().min(1),
        mimeType: z.string().min(1),
        sizeBytes: z.number().int().min(0),
        kind: z.enum(["damage", "overall"]),
      }),
    )
    .mutation(async ({ input }) => {
      const row = await loadValidToken(input.token);
      if (!input.storagePath.startsWith(`orgs/${row.organizationId}/`)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Storage path is outside the org's prefix.",
        });
      }
      const file = await prisma.file.create({
        data: {
          organizationId: row.organizationId,
          storagePath: input.storagePath,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          category: "photo",
          entityType: "check_in",
          entityId: row.jobId,
          uploadedByUserId: row.createdByUserId, // desktop initiator "owns" it
        },
      });

      // Upsert the CheckIn draft with the new file id appended to the
      // right array. Existing rows go through `push` (Prisma's array
      // update op); new rows initialize the array from scratch.
      const existing = await prisma.checkIn.findFirst({
        where: { jobId: row.jobId },
        select: { id: true, damagePhotoFileIds: true, overallPhotoFileIds: true },
      });
      if (existing) {
        await prisma.checkIn.update({
          where: { id: existing.id },
          data:
            input.kind === "damage"
              ? { damagePhotoFileIds: { push: file.id } }
              : { overallPhotoFileIds: { push: file.id } },
        });
      } else {
        await prisma.checkIn.create({
          data: {
            organizationId: row.organizationId,
            jobId: row.jobId,
            performedByUserId: row.createdByUserId,
            damagePhotoFileIds: input.kind === "damage" ? [file.id] : [],
            overallPhotoFileIds: input.kind === "overall" ? [file.id] : [],
          },
        });
      }

      if (input.mimeType.startsWith("image/")) {
        await inngest.send({
          name: "image.process",
          data: {
            orgId: row.organizationId,
            fileId: file.id,
            storagePath: file.storagePath,
            mimeType: file.mimeType,
          },
        });
      }

      return { fileId: file.id };
    }),

  /**
   * Mobile taps Done. Marks the token completed, then hands off to the
   * shared finalizer so the job transitions to `checked_in`.
   */
  completePrep: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const row = await loadValidToken(input.token);
      await prisma.mobileCheckInToken.update({
        where: { id: row.id },
        data: { completedAt: new Date() },
      });
      const res = await finalizeCheckIn(prisma, {
        jobId: row.jobId,
        organizationId: row.organizationId,
        performedByUserId: row.createdByUserId,
        reason: "mobile_photos",
        patch: {},
        timelineData: { via: "mobile_qr" },
      });
      return { id: res.checkInId };
    }),
});
