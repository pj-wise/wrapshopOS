"use client";

import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Loader2, RefreshCw, Smartphone, Wifi } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc/client";

/**
 * Desktop QR modal. Mints a mobile-check-in token, renders it as a QR +
 * shows the URL as a fallback (for testing or printouts). Polls
 * `checkIn.prepStatus` every 3s to reflect phone connection + rising
 * photo count, then auto-closes when the tech taps Done.
 */
export function CheckInQrModal({
  open,
  onOpenChange,
  jobId,
  onCompleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  onCompleted: () => void;
}) {
  const start = trpc.checkIn.startPrep.useMutation();
  const [token, setToken] = useState<string | null>(null);
  const [mobileUrl, setMobileUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);

  // Mint the token on first open. Reset state when dialog closes so a
  // re-open gets a fresh prep session.
  useEffect(() => {
    if (!open) {
      setToken(null);
      setMobileUrl(null);
      setExpiresAt(null);
      return;
    }
    if (token) return;
    void (async () => {
      try {
        const res = await start.mutateAsync({ jobId });
        setToken(res.token);
        setMobileUrl(res.mobileUrl);
        setExpiresAt(new Date(res.expiresAt));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't create link");
        onOpenChange(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const status = trpc.checkIn.prepStatus.useQuery(
    { token: token ?? "" },
    { enabled: !!token, refetchInterval: 3000 },
  );
  const connected = Boolean(status.data?.consumedAt);
  const photoCount = status.data?.photoCount ?? 0;
  const done = Boolean(status.data?.completedAt);

  // Auto-close as soon as the mobile side taps Done.
  useEffect(() => {
    if (done) onCompleted();
  }, [done, onCompleted]);

  async function regenerate() {
    try {
      const res = await start.mutateAsync({ jobId });
      setToken(res.token);
      setMobileUrl(res.mobileUrl);
      setExpiresAt(new Date(res.expiresAt));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't regenerate");
    }
  }

  const expired = expiresAt && expiresAt.getTime() < Date.now();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Scan with your phone</DialogTitle>
          <DialogDescription>
            Point your phone camera at the code, then walk the vehicle and
            capture photos. This window updates live.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          {mobileUrl ? (
            <div className="rounded-lg border bg-white p-4">
              <QRCodeSVG value={mobileUrl} size={220} level="M" includeMargin={false} />
            </div>
          ) : (
            <Skeleton className="h-[220px] w-[220px]" />
          )}

          {mobileUrl && (
            <a
              href={mobileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="max-w-full truncate text-center font-mono text-[11px] text-muted-foreground underline hover:text-foreground"
            >
              {mobileUrl}
            </a>
          )}

          <div className="flex w-full flex-col items-center gap-1 text-sm">
            {expired ? (
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                Link expired.
              </div>
            ) : connected ? (
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                <Wifi className="h-4 w-4" />
                Phone connected — {photoCount} photo{photoCount === 1 ? "" : "s"} captured
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Smartphone className="h-4 w-4 animate-pulse" />
                Waiting for phone to connect…
              </div>
            )}
            {expiresAt && !expired && !connected && (
              <div className="text-[10px] text-muted-foreground">
                {countdown(expiresAt)}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="justify-between sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={regenerate}
            disabled={start.isPending}
          >
            {start.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            )}
            Regenerate
          </Button>
          <Button type="button" onClick={() => onOpenChange(false)}>
            {done ? (
              <>
                <Check className="mr-1.5 h-3.5 w-3.5" />
                Done
              </>
            ) : (
              "Close"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function countdown(target: Date): string {
  const ms = target.getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const mins = Math.floor(ms / 60_000);
  const secs = Math.floor((ms % 60_000) / 1000);
  return `Link valid for ${mins}m ${String(secs).padStart(2, "0")}s`;
}
