"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc/client";

/**
 * Skip-photos acknowledgement. Requires the tech to check the liability
 * box; optional free-text reason is stored on `CheckIn.optOutReason` for
 * the audit trail.
 */
export function CheckInOptOutDialog({
  open,
  onOpenChange,
  jobId,
  onAcknowledged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  onAcknowledged: () => void;
}) {
  const optOut = trpc.checkIn.optOutPhotos.useMutation();
  const [ack, setAck] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) {
      setAck(false);
      setReason("");
    }
  }, [open]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!ack) {
      toast.error("Check the acknowledgement to continue.");
      return;
    }
    try {
      await optOut.mutateAsync({
        jobId,
        reason: reason.trim() || undefined,
      });
      onAcknowledged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Skip photo documentation</DialogTitle>
          <DialogDescription>
            The vehicle will be checked in without a photo record. Please
            acknowledge before proceeding.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              Without pre-work photos, disputes about scratches, dents, or
              interior condition become the shop&apos;s word against the
              customer&apos;s.
            </div>
          </div>

          <label className="flex items-start gap-2 rounded-md border bg-card p-3 text-sm">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0"
              required
            />
            <span>
              I acknowledge my shop is assuming damage-liability risk for this
              vehicle without a photo record.
            </span>
          </label>

          <div>
            <Label htmlFor="optout-reason" className="text-xs">
              Reason (optional)
            </Label>
            <Textarea
              id="optout-reason"
              rows={2}
              placeholder="e.g. customer brought vehicle with existing damage inspection paperwork"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={optOut.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={!ack || optOut.isPending}>
              {optOut.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Check in without photos
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
