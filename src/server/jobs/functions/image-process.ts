import "server-only";

import sharp from "sharp";

import { inngest } from "../client";
import { prisma } from "@/server/db";
import { getStorageProvider } from "@/server/providers/registry";

/**
 * image.process — for every uploaded image, strip EXIF, generate a thumbnail
 * (200px) and medium (800px) rendition, upload both alongside the original,
 * and record the thumbnail paths on the File row.
 *
 * The original is preserved (we never overwrite it). Renditions live under
 * a `.thumbs/<fileId>/` sibling folder.
 *
 * Idempotency: `event.data.fileId` — if the File row already has thumbnails,
 * the second run skips work. If a partial run left thumbnails on disk, the
 * `upsert: true` upload will overwrite them.
 *
 * Note: we do the whole download → resize → upload → record inside a single
 * step. Inngest step boundaries JSON-serialize their return values (buffers
 * lose their type), so keeping the buffer local to one step is cleaner than
 * hex-encoding across boundaries. Retries re-run the whole step from scratch,
 * which is safe because storage uploads use upsert.
 */
export const processImage = inngest.createFunction(
  {
    id: "image.process",
    name: "Process uploaded image",
    retries: 3,
  },
  { event: "image.process" },
  async ({ event, step }) => {
    const { orgId, fileId, storagePath, mimeType } = event.data;

    if (!mimeType.startsWith("image/")) {
      return { skipped: true, reason: "not-an-image" };
    }

    return await step.run("process-image", async () => {
      const file = await prisma.file.findFirst({
        where: { id: fileId, organizationId: orgId },
        select: { id: true, thumbnails: true },
      });
      if (!file) return { skipped: true, reason: "file-not-found" };

      const thumbs = file.thumbnails as Record<string, unknown> | null;
      if (thumbs && "thumb" in thumbs && "medium" in thumbs) {
        return { skipped: true, reason: "already-processed" };
      }

      const storage = await getStorageProvider(orgId);
      const originalBuf = Buffer.from(await storage.read(storagePath));

      const [thumb, medium] = await Promise.all([
        sharp(originalBuf)
          .rotate() // bake EXIF orientation before stripping
          .resize({ width: 200, withoutEnlargement: true })
          .withMetadata({ orientation: undefined })
          .jpeg({ quality: 80 })
          .toBuffer(),
        sharp(originalBuf)
          .rotate()
          .resize({ width: 800, withoutEnlargement: true })
          .withMetadata({ orientation: undefined })
          .jpeg({ quality: 85 })
          .toBuffer(),
      ]);

      const dir = dirOf(storagePath);
      const thumbPath = `${dir}/.thumbs/${fileId}/thumb.jpg`;
      const mediumPath = `${dir}/.thumbs/${fileId}/medium.jpg`;

      await storage.put(thumbPath, new Uint8Array(thumb), "image/jpeg");
      await storage.put(mediumPath, new Uint8Array(medium), "image/jpeg");

      await prisma.file.update({
        where: { id: fileId },
        data: { thumbnails: { thumb: thumbPath, medium: mediumPath } },
      });

      return { fileId, thumbPath, mediumPath };
    });
  },
);

function dirOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
}
