"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Car, Wrench } from "lucide-react";

import { trpc } from "@/lib/trpc/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { type JobStageKey } from "@/lib/production-catalog";
import type { RouterOutputs } from "@/lib/trpc/types";
import { EditQuoteDialog } from "@/modules/quotes/edit-quote-dialog";
import { useFeature } from "@/hooks/use-features";
import { CheckInPrepDialog } from "./check-in-prep-dialog";
import { DeliverConfirmDialog } from "./deliver-confirm-dialog";

type JobRow = RouterOutputs["jobs"]["list"]["items"][number];
type WorkflowStageRow = RouterOutputs["workflow"]["getStages"]["stages"][number];

// Terminal stages we never show as their own Kanban column. Jobs in these
// states still exist and remain accessible from the jobs list, but they'd
// clutter a horizontal board designed around the active pipeline.
const NON_BOARD_STAGES = new Set<JobStageKey>(["on_hold", "canceled"]);

/**
 * Production Kanban board.
 *
 * HTML5 drag-and-drop (no extra dep): cards are `draggable`, columns are
 * dropzones. Move fires `jobs.update({ status })` with an optimistic UI
 * update. If the server rejects we revert + toast.
 *
 * Realtime broadcast to other users lands as a Phase 5.5 follow-up
 * (Supabase Realtime channel `jobs:${orgId}` — currently we refetch on
 * mutation success which is enough for a single-user shop demo).
 */
export function ProductionBoard() {
  const query = trpc.jobs.list.useQuery();
  const workflowQ = trpc.workflow.getStages.useQuery();
  const update = trpc.jobs.update.useMutation();
  const utils = trpc.useUtils();

  const [dragging, setDragging] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useState<Record<string, JobStageKey>>({});
  const [editQuoteId, setEditQuoteId] = useState<string | null>(null);
  // Non-null while the Pro-tier mobile check-in intermediate flow is open.
  // The Kanban drop that triggered it is suspended until this resolves.
  const [prepJob, setPrepJob] = useState<{ id: string; number: number } | null>(null);
  // Same pattern for the Delivered drop — mirror the intercept so the shop
  // sees a running-balance summary + notify option before the stage flip.
  const [deliverJob, setDeliverJob] = useState<{ id: string; number: number } | null>(null);
  const mobileCheckIn = useFeature("operations.mobile_check_in");
  const mobileCheckInEnabled =
    mobileCheckIn.state === "enabled" || mobileCheckIn.state === "beta";

  const items = query.data?.items ?? [];
  const effective = (job: JobRow): string => optimistic[job.id] ?? job.status;

  // Board columns = every visible workflow stage in the org's chosen order,
  // minus terminal states (on_hold/canceled) which live in a separate list.
  const columns: WorkflowStageRow[] = (workflowQ.data?.stages ?? []).filter(
    (s) => !s.hidden && !NON_BOARD_STAGES.has(s.key),
  );

  const byColumn = new Map<string, JobRow[]>();
  for (const col of columns) byColumn.set(col.key, []);
  for (const job of items) {
    const stage = effective(job);
    if (byColumn.has(stage)) byColumn.get(stage)!.push(job);
  }

  async function onDrop(targetStage: JobStageKey) {
    if (!dragging) return;
    const job = items.find((j) => j.id === dragging);
    setDragging(null);
    if (!job || job.status === targetStage) return;

    // Pro-tier intermediate flow — dragging into "Checked in" opens the
    // photo prep / opt-out dialog instead of firing the status update.
    // The dialog itself flips the job when the user completes either
    // path, then invalidates jobs.list so the card lands correctly.
    if (targetStage === "checked_in" && mobileCheckInEnabled) {
      setPrepJob({ id: job.id, number: job.number });
      return;
    }

    // Delivered drop opens a confirmation with the invoice summary. The
    // dialog itself calls jobs.markDelivered (fires the downstream
    // notify-customer chain). Bypasses the generic jobs.update path so
    // the timeline/audit + inngest event actually fire.
    if (targetStage === "delivered") {
      setDeliverJob({ id: job.id, number: job.number });
      return;
    }

    setOptimistic((prev) => ({ ...prev, [job.id]: targetStage }));
    try {
      await update.mutateAsync({ id: job.id, status: targetStage });
      await utils.jobs.list.invalidate();
    } catch (err) {
      setOptimistic((prev) => {
        const next = { ...prev };
        delete next[job.id];
        return next;
      });
      toast.error(err instanceof Error ? err.message : "Move failed");
    } finally {
      setOptimistic((prev) => {
        const next = { ...prev };
        delete next[job.id];
        return next;
      });
    }
  }

  const isLoading = query.isLoading || workflowQ.isLoading;

  return (
    <div className="mx-auto max-w-full">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Production board</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Drag cards across columns to advance their stage. Approved quotes drop
            into the first column automatically. Reorder or rename stages under
            <span className="mx-1 rounded bg-muted px-1 font-mono text-xs">
              Settings → Job workflow
            </span>
            .
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-96 w-72 shrink-0" />
          ))}
        </div>
      ) : (
        <div className="flex gap-3 pb-4">
          {columns.map((col) => {
            const rows = byColumn.get(col.key) ?? [];
            return (
              <div
                key={col.key}
                className="flex w-72 shrink-0 flex-col rounded-lg border bg-muted/30"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(col.key)}
              >
                <div className="flex items-center justify-between gap-2 border-b px-3 py-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${col.dot}`}
                      aria-hidden
                    />
                    {col.label}
                  </span>
                  <span className="tabular-nums">{rows.length}</span>
                </div>
                <ul className="flex-1 space-y-2 p-2">
                  {rows.length === 0 && (
                    <li className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                      Drop here
                    </li>
                  )}
                  {rows.map((job) => (
                    <li key={job.id}>
                      <JobCard
                        job={job}
                        onDragStart={() => setDragging(job.id)}
                        onDragEnd={() => setDragging(null)}
                        dimmed={dragging === job.id}
                        onEdit={() => job.quote && setEditQuoteId(job.quote.id)}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      <EditQuoteDialog
        open={!!editQuoteId}
        onOpenChange={(v) => !v && setEditQuoteId(null)}
        quoteId={editQuoteId}
      />

      {prepJob && (
        <CheckInPrepDialog
          open
          onOpenChange={(v) => !v && setPrepJob(null)}
          jobId={prepJob.id}
          jobNumber={prepJob.number}
          onDone={(transitioned) => {
            setPrepJob(null);
            if (transitioned) {
              // Server already flipped the job to checked_in via the
              // finalizer — refresh so the card animates into its new column.
              void utils.jobs.list.invalidate();
            }
          }}
        />
      )}

      {deliverJob && (
        <DeliverConfirmDialog
          open
          onOpenChange={(v) => !v && setDeliverJob(null)}
          jobId={deliverJob.id}
          jobNumber={deliverJob.number}
          onDone={(transitioned) => {
            setDeliverJob(null);
            if (transitioned) void utils.jobs.list.invalidate();
          }}
        />
      )}
    </div>
  );
}

function JobCard({
  job,
  onDragStart,
  onDragEnd,
  dimmed,
  onEdit,
}: {
  job: JobRow;
  onDragStart: () => void;
  onDragEnd: () => void;
  dimmed?: boolean;
  onEdit: () => void;
}) {
  const vehicle = job.vehicle
    ? [job.vehicle.year, job.vehicle.make, job.vehicle.model].filter(Boolean).join(" ")
    : null;
  const hasQuote = Boolean(job.quote);

  // With a quote → click opens the modal. Without a quote (rare — a job
  // was created independent of the quote flow) fall back to the job detail
  // route so users can still reach it.
  const commonProps = {
    draggable: true as const,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.effectAllowed = "move";
      onDragStart();
    },
    onDragEnd,
    className: `block cursor-grab rounded-md border bg-card p-3 shadow-sm hover:border-primary/30 active:cursor-grabbing text-left w-full ${dimmed ? "opacity-40" : ""}`,
  };

  if (!hasQuote) {
    return (
      <Link href={`/jobs/${job.id}`} {...commonProps}>
        <JobCardBody job={job} vehicle={vehicle} />
      </Link>
    );
  }
  return (
    <button type="button" onClick={onEdit} {...commonProps}>
      <JobCardBody job={job} vehicle={vehicle} />
    </button>
  );
}

function JobCardBody({ job, vehicle }: { job: JobRow; vehicle: string | null }) {
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-mono tabular-nums font-medium">
              J-{String(job.number).padStart(4, "0")}
            </span>
            {job.priority !== "normal" && (
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                {job.priority}
              </Badge>
            )}
          </div>
          <div className="mt-1 truncate text-sm font-medium">
            {job.title || job.customer.name}
          </div>
        </div>
      </div>
      <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
        {vehicle && (
          <div className="flex items-center gap-1 truncate">
            <Car className="h-3 w-3 shrink-0" />
            <span className="truncate">{vehicle}</span>
          </div>
        )}
        <div className="flex items-center gap-1 truncate">
          <Wrench className="h-3 w-3 shrink-0" />
          <span className="truncate">{job.bay?.name ?? "no bay"}</span>
        </div>
      </div>
    </>
  );
}
