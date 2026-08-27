"use client";

import Link from "next/link";
import { CalendarPlus, Car, FileText, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { JobStatusBadge } from "./job-status-badge";

/**
 * Pending Scheduling panel — jobs that a customer has approved but no one
 * has dropped onto the calendar yet. Rendered on:
 *   - /quotes (below the quotes list so the shop sees "you sent quote X;
 *              customer approved it; now schedule it")
 *   - /dashboard (near the calendar so it's visible at-a-glance)
 *   - /schedule (as a sidebar-style prompt above the calendar)
 *
 * The list is intentionally read-only from here — each row links to the
 * job detail page where scheduling is done. Density is compact so the
 * panel can share a page with other content without dominating it.
 */
export function PendingSchedulingList({
  variant = "default",
  maxItems,
}: {
  variant?: "default" | "compact";
  /** Cap rows shown (e.g. dashboard shows top 5 with a link to see all). */
  maxItems?: number;
}) {
  const q = trpc.jobs.pendingScheduling.useQuery();
  const utils = trpc.useUtils();
  const backfill = trpc.quotes.backfillApprovedJobs.useMutation();

  const items = q.data?.items ?? [];
  const shown = maxItems ? items.slice(0, maxItems) : items;
  const overflow = maxItems ? Math.max(0, items.length - maxItems) : 0;

  async function onBackfill() {
    try {
      const res = await backfill.mutateAsync();
      await utils.jobs.pendingScheduling.invalidate();
      const parts: string[] = [];
      if (res.created > 0) {
        parts.push(`Created ${res.created} job${res.created === 1 ? "" : "s"}`);
      }
      if (res.repaired > 0) {
        parts.push(
          `Reset ${res.repaired} unscheduled job${res.repaired === 1 ? "" : "s"} to Approved`,
        );
      }
      if (parts.length > 0) {
        toast.success(parts.join(" · ") + ".");
      } else if (res.candidates === 0) {
        toast.info("Every approved quote already has a job. Nothing to backfill.");
      } else {
        toast.info("No jobs created — check server logs for details.");
      }
      if (res.failures.length > 0) {
        console.warn("[backfill] failures:", res.failures);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Backfill failed");
    }
  }

  return (
    <section className="rounded-lg border bg-card">
      <header className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <CalendarPlus className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Pending scheduling</h2>
          {items.length > 0 && (
            <Badge variant="outline" className="text-[10px] tabular-nums">
              {items.length}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <p className="hidden text-xs text-muted-foreground md:block">
            Approved jobs waiting for a calendar slot.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onBackfill}
            disabled={backfill.isPending}
            title="Materialize jobs for approved quotes that never made it into the list"
          >
            {backfill.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            )}
            Backfill
          </Button>
        </div>
      </header>

      {q.isLoading ? (
        <div className="space-y-2 p-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          {items.length === 0
            ? "Nothing to schedule right now — every approved job is on the calendar."
            : "No pending jobs after filter."}
        </div>
      ) : (
        <ul className="divide-y">
          {shown.map((job) => {
            const vehicle = job.vehicle
              ? [job.vehicle.year, job.vehicle.make, job.vehicle.model, job.vehicle.trim]
                  .filter(Boolean)
                  .join(" ")
              : null;
            return (
              <li key={job.id}>
                <Link
                  href={`/jobs/${job.id}`}
                  className="flex items-center justify-between gap-4 px-3 py-2.5 hover:bg-accent/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm tabular-nums">
                        J-{String(job.number).padStart(4, "0")}
                      </span>
                      <JobStatusBadge status={job.status} />
                    </div>
                    <div className="mt-0.5 truncate text-sm">
                      {job.title || job.customer.name}
                    </div>
                    {variant !== "compact" && vehicle && (
                      <div className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <Car className="h-3 w-3 shrink-0" />
                        <span className="truncate">{vehicle}</span>
                      </div>
                    )}
                  </div>
                  {job.quote && variant !== "compact" && (
                    <div className="hidden shrink-0 items-center gap-1 text-xs text-muted-foreground sm:flex">
                      <FileText className="h-3 w-3" />
                      Q-{String(job.quote.number).padStart(4, "0")}
                    </div>
                  )}
                  <div className="shrink-0 text-xs text-muted-foreground">
                    Approved {formatRelativeShort(job.createdAt)}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {overflow > 0 && (
        <div className="border-t px-3 py-2 text-right text-xs">
          <Link
            href="/schedule"
            className="text-muted-foreground hover:text-foreground hover:underline"
          >
            +{overflow} more · Open schedule →
          </Link>
        </div>
      )}
    </section>
  );
}

// Simple "3 days ago" / "yesterday" / "today" formatter — no external dep.
function formatRelativeShort(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const days = Math.round((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.round(days / 7)}w ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
