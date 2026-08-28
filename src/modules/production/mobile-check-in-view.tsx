"use client";

import { useRef, useState } from "react";
import { AlertCircle, Camera, Check, ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Phone-side view for the mobile check-in hand-off. Tokenized, no auth.
 *
 * Flow:
 *   1. Resolve token → shows job + customer + vehicle, stamps `consumedAt`
 *      so the desktop's QR modal flips into "phone connected".
 *   2. Two capture buttons — "Overall" and "Damage close-up" — trigger a
 *      native file input with `capture="environment"` so iOS/Android
 *      open the camera by default.
 *   3. Each upload: `mobileCreateUploadUrl` → direct PUT to Supabase →
 *      `mobileFinalizeUpload` → append fileId to the CheckIn row.
 *   4. Tap "Done" to complete → desktop poll picks up, dialog closes.
 */
export function MobileCheckInView({ token }: { token: string }) {
  const info = trpc.checkIn.resolveMobileToken.useQuery({ token }, { retry: false });
  const createUpload = trpc.checkIn.mobileCreateUploadUrl.useMutation();
  const finalize = trpc.checkIn.mobileFinalizeUpload.useMutation();
  const complete = trpc.checkIn.completePrep.useMutation();
  const utils = trpc.useUtils();

  const overallInputRef = useRef<HTMLInputElement | null>(null);
  const damageInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState<{ overall: number; damage: number }>({
    overall: 0,
    damage: 0,
  });
  const [completed, setCompleted] = useState(false);

  if (info.isLoading) {
    return (
      <div className="mx-auto max-w-md p-4">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="mt-2 h-4 w-40" />
        <div className="mt-6 grid grid-cols-1 gap-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (info.error || !info.data) {
    return (
      <div className="mx-auto max-w-md p-4">
        <div className="flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-medium">Link unavailable</div>
            <div className="mt-1 text-xs opacity-80">
              {info.error?.message ??
                "This mobile check-in link is invalid, expired, or already used. Ask the shop to generate a fresh QR."}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-100">
          <Check className="h-7 w-7" />
        </div>
        <div className="text-xl font-semibold">Check-in complete</div>
        <p className="text-sm text-muted-foreground">
          You can put your phone down. The shop&apos;s desktop view already
          knows.
        </p>
      </div>
    );
  }

  const info_ = info.data;
  const totalOverall = info_.overallPhotoCount + uploading.overall;
  const totalDamage = info_.damagePhotoCount + uploading.damage;

  async function uploadFiles(list: FileList | null, kind: "overall" | "damage") {
    if (!list || list.length === 0) return;
    setUploading((s) => ({ ...s, [kind]: s[kind] + list.length }));
    try {
      for (const file of Array.from(list)) {
        try {
          const signed = await createUpload.mutateAsync({
            token,
            fileName: file.name,
            mimeType: file.type || "image/jpeg",
            sizeBytes: file.size,
          });
          const put = await fetch(signed.url, {
            method: signed.method,
            body: file,
            headers: {
              "content-type": file.type || "image/jpeg",
            },
          });
          if (!put.ok) throw new Error(`Upload failed: HTTP ${put.status}`);
          await finalize.mutateAsync({
            token,
            storagePath: signed.storagePath,
            mimeType: file.type || "image/jpeg",
            sizeBytes: file.size,
            kind,
          });
        } catch (err) {
          toast.error(`${file.name}: ${err instanceof Error ? err.message : "upload failed"}`);
        } finally {
          setUploading((s) => ({ ...s, [kind]: Math.max(0, s[kind] - 1) }));
        }
      }
      await utils.checkIn.resolveMobileToken.invalidate({ token });
    } catch {
      // per-file errors already toasted; nothing to do here.
    }
  }

  async function onDone() {
    if (totalOverall + totalDamage === 0) {
      toast.error("Capture at least one photo before completing.");
      return;
    }
    if (uploading.overall + uploading.damage > 0) {
      toast.error("Wait for uploads to finish first.");
      return;
    }
    try {
      await complete.mutateAsync({ token });
      setCompleted(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't complete");
    }
  }

  return (
    <div className="mx-auto max-w-md p-4 pb-24">
      <header className="mb-4">
        <h1 className="text-lg font-semibold">
          J-{String(info_.jobNumber).padStart(4, "0")} · Check-in
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{info_.customerName}</p>
        {info_.vehicleSummary && (
          <p className="text-sm text-muted-foreground">{info_.vehicleSummary}</p>
        )}
      </header>

      <div className="space-y-3">
        <CaptureCard
          title="Overall photos"
          subtitle="Walk around the whole vehicle — 6 to 8 shots is plenty."
          count={totalOverall}
          uploading={uploading.overall}
          icon={<ImagePlus className="h-5 w-5" />}
          onClick={() => overallInputRef.current?.click()}
        />
        <input
          ref={overallInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={(e) => uploadFiles(e.target.files, "overall")}
        />

        <CaptureCard
          title="Damage close-ups"
          subtitle="Zoom in on scratches, dents, wheel curbs, interior wear."
          count={totalDamage}
          uploading={uploading.damage}
          icon={<Camera className="h-5 w-5" />}
          onClick={() => damageInputRef.current?.click()}
        />
        <input
          ref={damageInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={(e) => uploadFiles(e.target.files, "damage")}
        />
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t bg-background p-4">
        <Button
          type="button"
          onClick={onDone}
          disabled={complete.isPending}
          className="w-full"
          size="lg"
        >
          {complete.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Done — return to desktop
        </Button>
      </div>
    </div>
  );
}

function CaptureCard({
  title,
  subtitle,
  count,
  uploading,
  icon,
  onClick,
}: {
  title: string;
  subtitle: string;
  count: number;
  uploading: number;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent/40"
    >
      <div className="grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="text-base font-medium">{title}</div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {uploading > 0 && <Loader2 className="h-3 w-3 animate-spin" />}
            {count} photo{count === 1 ? "" : "s"}
          </div>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </button>
  );
}
