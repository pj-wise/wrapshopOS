import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createTRPCRouter,
  orgProcedure,
} from "../init";
import { getStorageProvider } from "@/server/providers/registry";
import { inngest } from "@/server/jobs/client";

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50MB — matches Supabase bucket limit
const ALLOWED_CATEGORIES = [
  "photo",
  "signature",
  "pdf",
  "inspection",
  "contract",
  "attachment",
  "avatar",
] as const;

export const filesRouter = createTRPCRouter({
  createUploadUrl: orgProcedure
    .input(
      z.object({
        fileName: z.string().min(1).max(200),
        mimeType: z.string().min(1).max(120),
        sizeBytes: z.number().int().min(0).max(MAX_UPLOAD_BYTES),
        category: z.enum(ALLOWED_CATEGORIES).default("attachment"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const storage = await getStorageProvider(ctx.session.organizationId);
      const signed = await storage.createUploadUrl({
        orgId: ctx.session.organizationId,
        category: input.category,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
      });
      return signed;
    }),

  /**
   * After the client PUTs to the signed URL, it calls this with the returned
   * `storagePath` so we persist a File row + kick off image processing.
   */
  finalize: orgProcedure
    .meta({ audit: { entity: "file", action: "finalize" } })
    .input(
      z.object({
        storagePath: z.string().min(1),
        mimeType: z.string().min(1),
        sizeBytes: z.number().int().min(0),
        category: z.enum(ALLOWED_CATEGORIES),
        entityType: z.string().optional(),
        entityId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Guard: storagePath must start with our per-org prefix.
      if (!input.storagePath.startsWith(`orgs/${ctx.session.organizationId}/`)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Storage path is outside your org's prefix.",
        });
      }
      const file = await ctx.db.file.create({
        data: {
          organizationId: ctx.session.organizationId,
          storagePath: input.storagePath,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          category: input.category,
          entityType: input.entityType ?? null,
          entityId: input.entityId ?? null,
          uploadedByUserId: ctx.session.userId,
        },
      });

      if (input.mimeType.startsWith("image/")) {
        await inngest.send({
          name: "image.process",
          data: {
            orgId: ctx.session.organizationId,
            fileId: file.id,
            storagePath: file.storagePath,
            mimeType: file.mimeType,
          },
        });
      }

      return file;
    }),

  getDownloadUrl: orgProcedure
    .input(z.object({ fileId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const file = await ctx.db.file.findFirst({
        where: { id: input.fileId, deletedAt: null },
      });
      if (!file) throw new TRPCError({ code: "NOT_FOUND" });
      const storage = await getStorageProvider(ctx.session.organizationId);
      const thumbs = file.thumbnails as { thumb?: string; medium?: string };
      const [full, thumb, medium] = await Promise.all([
        storage.createDownloadUrl(file.storagePath),
        thumbs?.thumb
          ? storage.createDownloadUrl(thumbs.thumb)
          : Promise.resolve(null),
        thumbs?.medium
          ? storage.createDownloadUrl(thumbs.medium)
          : Promise.resolve(null),
      ]);
      return {
        url: full.url,
        thumbUrl: thumb?.url ?? null,
        mediumUrl: medium?.url ?? null,
        mimeType: file.mimeType,
      };
    }),
});
