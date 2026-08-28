"use client";

import { useState } from "react";
import { AlertTriangle, QrCode, SkipForward } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckInQrModal } from "./check-in-qr-modal";
import { CheckInOptOutDialog } from "./check-in-opt-out-dialog";

/**
 * First step of the pro-tier mobile check-in flow. Two big tiles:
 *   1. Take photos on phone — hands off to the tech's phone via QR.
 *   2. Skip photos — opt-out with liability acknowledgement.
 *
 * `onDone(true)` fires when either path completes and the parent should
 * treat the job as `checked_in`. `onDone(false)` fires on user cancel —
 * the parent should NOT advance the job.
 */
export function CheckInPrepDialog({
  open,
  onOpenChange,
  jobId,
  jobNumber,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  jobNumber: number;
  onDone: (transitioned: boolean) => void;
}) {
  const [qrOpen, setQrOpen] = useState(false);
  const [optOutOpen, setOptOutOpen] = useState(false);

  function close(transitioned: boolean) {
    onOpenChange(false);
    onDone(transitioned);
  }

  return (
    <>
      <Dialog
        open={open && !qrOpen && !optOutOpen}
        onOpenChange={(v) => {
          if (!v) close(false);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Check in J-{String(jobNumber).padStart(4, "0")}
            </DialogTitle>
            <DialogDescription>
              Before the vehicle enters the shop, capture a photo record — or
              acknowledge the risk of skipping it.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setQrOpen(true)}
              className="group flex flex-col items-start gap-2 rounded-lg border-2 border-primary/40 bg-primary/5 p-4 text-left transition-colors hover:border-primary hover:bg-primary/10"
            >
              <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 text-primary">
                <QrCode className="h-5 w-5" />
              </div>
              <div className="text-base font-semibold">Take photos on phone</div>
              <p className="text-xs text-muted-foreground">
                Scan a QR code and capture damage + overall shots. Recommended.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setOptOutOpen(true)}
              className="group flex flex-col items-start gap-2 rounded-lg border-2 border-amber-300/60 bg-amber-50/40 p-4 text-left transition-colors hover:border-amber-400 hover:bg-amber-100/60 dark:border-amber-700/40 dark:bg-amber-500/5 dark:hover:bg-amber-500/10"
            >
              <div className="grid h-10 w-10 place-items-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-100">
                <SkipForward className="h-5 w-5" />
              </div>
              <div className="text-base font-semibold">Skip photos</div>
              <p className="text-xs text-muted-foreground">
                Your shop assumes damage-liability risk without a photo record.
              </p>
              <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-amber-800 dark:text-amber-100">
                <AlertTriangle className="h-3 w-3" />
                Not recommended
              </p>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <CheckInQrModal
        open={qrOpen}
        onOpenChange={setQrOpen}
        jobId={jobId}
        onCompleted={() => {
          setQrOpen(false);
          close(true);
        }}
      />

      <CheckInOptOutDialog
        open={optOutOpen}
        onOpenChange={setOptOutOpen}
        jobId={jobId}
        onAcknowledged={() => {
          setOptOutOpen(false);
          close(true);
        }}
      />
    </>
  );
}
