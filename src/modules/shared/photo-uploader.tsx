"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Loader2, X } from "lucide-react";

import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";

/**
 * PhotoUploader — direct-to-Supabase Storage via signed PUT URLs.
 *
 * Flow: pick file(s) → for each: `files.createUploadUrl` → PUT to signed URL
 * → `files.finalize` (writes File row + enqueues image.process for thumbnails)
 * → callback fires with the created fileId.
 *
 * Called by:
 *   - Job Photos tab (Phase 5): captures `phase` and calls jobs.addPhoto after.
 *   - Check-in flow (Phase 5): captures damage / overall photo lists.
 *
 * Multiple files upload in parallel. Failed ones toast and drop out.
 */
type Pending = { name: string; progress: number };

export function PhotoUploader({
  onUploaded,
  category = "photo",
  accept = "image/*",
  multiple = true,
  entityType,
  entityId,
  label = "Add photos",
}: {
  onUploaded: (fileId: string, meta: { mimeType: string; sizeBytes: number }) => Promise<void> | void;
  category?: "photo" | "signature" | "pdf" | "inspection" | "contract" | "attachment" | "avatar";
  accept?: string;
  multiple?: boolean;
  entityType?: string;
  entityId?: string;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const createUpload = trpc.files.createUploadUrl.useMutation();
  const finalize = trpc.files.finalize.useMutation();

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    setPending((prev) => [...prev, ...list.map((f) => ({ name: f.name, progress: 0 }))]);

    await Promise.all(
      list.map(async (file) => {
        try {
          const signed = await createUpload.mutateAsync({
            fileName: file.name,
            mimeType: file.type || "application/octet-stream",
            sizeBytes: file.size,
            category,
          });

          const put = await fetch(signed.url, {
            method: signed.method,
            body: file,
            headers: { "content-type": file.type || "application/octet-stream" },
          });
          if (!put.ok) throw new Error(`Upload failed: HTTP ${put.status}`);

          const record = await finalize.mutateAsync({
            storagePath: signed.storagePath,
            mimeType: file.type || "application/octet-stream",
            sizeBytes: file.size,
            category,
            entityType,
            entityId,
          });

          await onUploaded(record.id, { mimeType: record.mimeType, sizeBytes: record.sizeBytes });
        } catch (err) {
          toast.error(`${file.name}: ${err instanceof Error ? err.message : "upload failed"}`);
        } finally {
          setPending((prev) => prev.filter((p) => p.name !== file.name));
        }
      }),
    );
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(e) => {
          handleFiles(e.target.files);
          e.currentTarget.value = "";
        }}
      />
      <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
        <ImagePlus className="mr-1 h-3.5 w-3.5" />
        {label}
      </Button>
      {pending.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          {pending.map((p) => (
            <li key={p.name} className="flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="truncate">{p.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Renders a signed thumbnail for a File by id. Lazy — fetches the URL on
 * mount. Falls back to a placeholder while loading.
 */
export function PhotoThumb({
  fileId,
  onRemove,
  size = "sm",
}: {
  fileId: string;
  onRemove?: () => void;
  size?: "sm" | "md";
}) {
  const q = trpc.files.getDownloadUrl.useQuery({ fileId });
  const dim = size === "sm" ? "h-16 w-16" : "h-24 w-24";
  return (
    <div className={`relative overflow-hidden rounded-md border bg-muted ${dim}`}>
      {q.data?.thumbUrl || q.data?.url ? (
        // Use a plain <img> — signed URLs change each render + Next Image
        // caching gets in the way of TTL rotation.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={q.data.thumbUrl ?? q.data.url}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="grid h-full w-full place-items-center text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-0.5 top-0.5 rounded-full bg-background/80 p-0.5 text-muted-foreground hover:text-foreground"
          title="Remove"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
