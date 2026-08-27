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
                      />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function JobCard({
  job,
  onDragStart,
  onDragEnd,
  dimmed,
}: {
  job: JobRow;
  onDragStart: () => void;
  onDragEnd: () => void;
  dimmed?: boolean;
}) {
  const vehicle = job.vehicle
    ? [job.vehicle.year, job.vehicle.make, job.vehicle.model].filter(Boolean).join(" ")
    : null;

  return (
    <Link
      href={`/jobs/${job.id}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={`block cursor-grab rounded-md border bg-card p-3 shadow-sm hover:border-primary/30 active:cursor-grabbing ${dimmed ? "opacity-40" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-mono tabular-nums font-medium">
              J-{String(job.number).padStart(4, "0")}
            </span>
            {job.priority !== "normal" && (
              <Badge
                variant="outline"
                className="text-[10px] uppercase tracking-wider"
              >
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
    </Link>
  );
}
