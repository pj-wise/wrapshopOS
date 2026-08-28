"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Send } from "lucide-react";

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
 * Confirmation dialog for the Kanban's Delivered drop. Fetches the invoice
 * tied to the Job (created at quote-approval time under the new invoice-at-
 * approval flow) and shows the running balance. Primary CTA marks the job
 * delivered + fires a `notifyCustomer: true` downstream event. Secondary
 * CTA delivers silently.
 *
 * Edge case: if no invoice exists (Job created outside the quote-approval
 * flow — walk-in, manual admin create), we show a warning and let the user
 * mark delivered silently. The existing `invoice-from-delivered-job`
 * Inngest handler will still fire and create the invoice as a backstop.
 *
 * `onDone(true)` fires when the job was successfully marked delivered.
 * `onDone(false)` fires on cancel/error — the parent should NOT advance
 * the card.
 */
export function DeliverConfirmDialog({
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
  const invoiceQ = trpc.invoices.list.useQuery(
    { limit: 100 },
    { enabled: open },
  );
  const markDelivered = trpc.jobs.markDelivered.useMutation();
  const [pending, setPending] = useState<"notify" | "silent" | null>(null);

  // Match this job's invoice inline from the list query. Keeps the surface
  // small (no new procedure) and matches how the invoices page already loads.
  const invoice = useMemo(() => {
    if (!invoiceQ.data?.items) return null;
    return invoiceQ.data.items.find((i) => i.job?.id === jobId) ?? null;
  }, [invoiceQ.data, jobId]);

  function close(transitioned: boolean) {
    onOpenChange(false);
    onDone(transitioned);
  }

  async function onDeliver(notify: boolean) {
    setPending(notify ? "notify" : "silent");
    try {
      await markDelivered.mutateAsync({ id: jobId, notifyCustomer: notify });
      toast.success(
        notify
          ? `J-${String(jobNumber).padStart(4, "0")} delivered. Customer notified.`
          : `J-${String(jobNumber).padStart(4, "0")} delivered.`,
      );
      close(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delivery failed");
      setPending(null);
    }
  }

  const isLoading = invoiceQ.isLoading;
  const hasInvoice = !!invoice;
  const balanceCents = invoice?.balanceCents ?? 0;
  const totalCents = invoice?.totalCents ?? 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !pending) close(false);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Deliver J-{String(jobNumber).padStart(4, "0")}
          </DialogTitle>
          <DialogDescription>
            Mark this job as delivered and hand it off to the customer.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : hasInvoice ? (
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Invoice INV-{String(invoice.number).padStart(4, "0")}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Total {formatCents(totalCents)} ·{" "}
              {balanceCents === 0 ? (
                <span className="text-emerald-700 dark:text-emerald-300">
                  paid in full
                </span>
              ) : (
                <span>
                  balance due{" "}
                  <span className="font-medium text-foreground">
                    {formatCents(balanceCents)}
                  </span>
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-100">
            <div className="flex items-center gap-1.5 font-medium">
              <AlertTriangle className="h-3.5 w-3.5" />
              No invoice found for this job
            </div>
            <p className="mt-1">
              This job wasn't created from an approved quote, so no invoice
              exists to bill against. Delivering will still trigger the
              downstream invoicing backstop, but you may want to review it
              after.
            </p>
          </div>
        )}

        <DialogFooter className="mt-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onDeliver(false)}
            disabled={!!pending}
          >
            Mark delivered only
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => onDeliver(true)}
            disabled={!!pending}
          >
            <Send className="mr-1.5 h-3.5 w-3.5" />
            {balanceCents > 0
              ? "Mark delivered & send balance reminder"
              : "Mark delivered & notify customer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}
