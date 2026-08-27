"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, GripVertical, Plus } from "lucide-react";

import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  JOB_STAGE_TONES,
  jobStageLabel,
  type JobStageKey,
} from "@/lib/production-catalog";
import {
  eventKindLabel,
  resolveEventTone,
} from "@/lib/event-catalog";
import type { RouterOutputs } from "@/lib/trpc/types";
import { NewEventDialog } from "./new-event-dialog";

type WorkflowStageRow = RouterOutputs["workflow"]["getStages"]["stages"][number];
type ScheduleBlockRow = RouterOutputs["schedule"]["list"][number];

/**
 * Dashboard job calendar.
 *
 * Three view modes:
 *   - "day"   — one column, hour rows (7am → 7pm)
 *   - "week"  — 7 columns (Sun → Sat) with a compact chip list per day
 *   - "month" — 6 rows × 7 columns of days with chip stack + "+N more" overflow
 *
 * Chip color derives from job.status via JOB_STAGE_TONES so the same tone
 * appears on the Kanban card, the badge, and here.
 *
 * Drag-to-reschedule: HTML5 native drag on each chip. Dropping on a day cell
 * updates scheduledStart to that day (preserving the original hour/minute)
 * and shifts scheduledEnd by the same delta so duration is retained.
 *
 * Persistence uses `jobs.update({ scheduledStart, scheduledEnd })` — the same
 * mutation the Kanban board uses. Optimistic UI + revert-on-failure toast.
 */

type JobRow = RouterOutputs["jobs"]["list"]["items"][number];
type ViewMode = "day" | "week" | "month";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_START = 7;
const HOUR_END = 19;
const HOURS_VISIBLE = HOUR_END - HOUR_START;

// ---- date math -------------------------------------------------------------

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(x.getDate() - x.getDay());
  return x;
}
function startOfMonth(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}
function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function isSameMonth(d: Date, ref: Date): boolean {
  return d.getMonth() === ref.getMonth() && d.getFullYear() === ref.getFullYear();
}

// ---- component -------------------------------------------------------------

export function JobCalendar() {
  const [mode, setMode] = useState<ViewMode>("week");
  const [anchor, setAnchor] = useState<Date>(() => startOfDay(new Date()));
  const [dragging, setDragging] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useState<
    Record<string, { start: Date; end: Date | null }>
  >({});

  const range = useMemo(() => {
    if (mode === "day") return { start: startOfDay(anchor), end: addDays(anchor, 1) };
    if (mode === "week") return { start: startOfWeek(anchor), end: addDays(startOfWeek(anchor), 7) };
    const monthStart = startOfMonth(anchor);
    const gridStart = addDays(monthStart, -monthStart.getDay());
    return { start: gridStart, end: addDays(gridStart, 42) };
  }, [mode, anchor]);

  const q = trpc.jobs.list.useQuery();
  const workflowQ = trpc.workflow.getStages.useQuery();
  const eventsQ = trpc.schedule.list.useQuery({
    rangeStart: range.start,
    rangeEnd: range.end,
  });
  const update = trpc.jobs.update.useMutation();
  const utils = trpc.useUtils();

  const workflow = workflowQ.data?.stages ?? [];
  const stageLabelFor = (key: string) =>
    workflow.find((s) => s.key === key)?.label ?? jobStageLabel(key);

  const jobs = (q.data?.items ?? [])
    .map((j) => applyOptimistic(j, optimistic))
    .filter((j) => {
      if (!j.scheduledStart) return false;
      const start = new Date(j.scheduledStart);
      return start >= range.start && start < range.end;
    });

  // Non-job schedule events (consult/inspection/meeting/other). Job-tied
  // blocks are already drawn from the jobs list — filter them here so we
  // don't render each scheduled job twice.
  const events = (eventsQ.data ?? []).filter((e) => e.jobId == null && e.kind !== "job");

  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [eventDefaultStart, setEventDefaultStart] = useState<Date | undefined>(undefined);
  const openEventDialog = (defaultStart?: Date) => {
    setEventDefaultStart(defaultStart);
    setEventDialogOpen(true);
  };

  async function move(jobId: string, dropTarget: Date, hourOverride?: number) {
    const original = q.data?.items.find((j) => j.id === jobId);
    if (!original) return;

    const origStart = original.scheduledStart ? new Date(original.scheduledStart) : new Date();
    const origEnd = original.scheduledEnd ? new Date(original.scheduledEnd) : null;
    const durationMs = origEnd ? origEnd.getTime() - origStart.getTime() : 60 * 60_000;

    const nextStart = new Date(dropTarget);
    if (hourOverride != null) {
      nextStart.setHours(hourOverride, 0, 0, 0);
    } else {
      nextStart.setHours(origStart.getHours(), origStart.getMinutes(), 0, 0);
    }
    const nextEnd = new Date(nextStart.getTime() + durationMs);

    // Optimistic
    setOptimistic((p) => ({ ...p, [jobId]: { start: nextStart, end: nextEnd } }));

    try {
      await update.mutateAsync({
        id: jobId,
        scheduledStart: nextStart,
        scheduledEnd: nextEnd,
      });
      await utils.jobs.list.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Move failed");
    } finally {
      setOptimistic((p) => {
        const next = { ...p };
        delete next[jobId];
        return next;
      });
    }
  }

  const shift = (delta: number) => {
    if (mode === "day") setAnchor((a) => addDays(a, delta));
    else if (mode === "week") setAnchor((a) => addDays(a, delta * 7));
    else {
      const next = new Date(anchor);
      next.setMonth(next.getMonth() + delta);
      setAnchor(next);
    }
  };

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3">
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => shift(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAnchor(startOfDay(new Date()))}
          >
            Today
          </Button>
          <Button size="sm" variant="ghost" onClick={() => shift(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="ml-2 text-sm font-medium tabular-nums">
            {formatRangeLabel(mode, anchor)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => openEventDialog(anchor)}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            New event
          </Button>
          <div className="rounded-md border p-0.5 text-xs">
            {(["day", "week", "month"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setMode(k)}
                className={cn(
                  "rounded px-2 py-1 capitalize",
                  mode === k ? "bg-accent" : "hover:bg-accent/60",
                )}
              >
                {k}
              </button>
            ))}
          </div>
        </div>
      </div>

      {q.isLoading ? (
        <Skeleton className="m-3 h-72" />
      ) : mode === "day" ? (
        <DayView
          day={anchor}
          jobs={jobs}
          events={events}
          dragging={dragging}
          setDragging={setDragging}
          onMove={move}
          stageLabelFor={stageLabelFor}
          onCellClick={openEventDialog}
        />
      ) : mode === "week" ? (
        <WeekView
          rangeStart={range.start}
          jobs={jobs}
          events={events}
          dragging={dragging}
          setDragging={setDragging}
          onMove={move}
          stageLabelFor={stageLabelFor}
          onCellClick={openEventDialog}
        />
      ) : (
        <MonthView
          rangeStart={range.start}
          anchor={anchor}
          jobs={jobs}
          events={events}
          dragging={dragging}
          setDragging={setDragging}
          onMove={move}
          stageLabelFor={stageLabelFor}
          onCellClick={openEventDialog}
        />
      )}

      <StageLegend stages={workflow} />

      <NewEventDialog
        open={eventDialogOpen}
        onOpenChange={setEventDialogOpen}
        defaultStart={eventDefaultStart}
      />
    </div>
  );
}

// ---- shared chip -----------------------------------------------------------

function JobChip({
  job,
  onDragStart,
  onDragEnd,
  compact,
  stageLabelFor,
}: {
  job: JobRow;
  onDragStart: () => void;
  onDragEnd: () => void;
  compact?: boolean;
  stageLabelFor: (key: string) => string;
}) {
  const tone = JOB_STAGE_TONES[job.status as JobStageKey] ?? JOB_STAGE_TONES.approved;
  const vehicle = job.vehicle
    ? [job.vehicle.year, job.vehicle.make, job.vehicle.model].filter(Boolean).join(" ")
    : null;
  const title = job.title || vehicle || job.customer.name;
  const start = job.scheduledStart ? new Date(job.scheduledStart) : null;
  const timeLabel = start
    ? start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : "";

  return (
    <Link
      href={`/jobs/${job.id}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", job.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "group flex cursor-grab items-center gap-1.5 truncate rounded-md border px-1.5 py-0.5 text-[11px] font-medium active:cursor-grabbing",
        tone.chip,
      )}
      title={`${title} · ${stageLabelFor(job.status)}${timeLabel ? ` · ${timeLabel}` : ""}`}
    >
      <GripVertical className="h-2.5 w-2.5 opacity-40 group-hover:opacity-100" />
      <span className="truncate">
        {!compact && timeLabel ? `${timeLabel} · ` : ""}
        {title}
      </span>
    </Link>
  );
}

function EventChip({
  event,
  compact,
}: {
  event: ScheduleBlockRow;
  compact?: boolean;
}) {
  const tone = resolveEventTone(event.kind, event.color);
  const title = event.title?.trim() || eventKindLabel(event.kind);
  const start = new Date(event.start);
  const timeLabel = start.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 truncate rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
        tone.chip,
      )}
      style={tone.style}
      title={`${title} · ${eventKindLabel(event.kind)} · ${timeLabel}`}
      onClick={(e) => e.stopPropagation()}
    >
      <span
        className={cn("h-2 w-2 shrink-0 rounded-full", tone.dot)}
        style={tone.dotStyle}
      />
      <span className="truncate">
        {!compact ? `${timeLabel} · ` : ""}
        {title}
      </span>
    </div>
  );
}

// ---- Day view --------------------------------------------------------------

function DayView({
  day,
  jobs,
  events,
  dragging,
  setDragging,
  onMove,
  stageLabelFor,
  onCellClick,
}: {
  day: Date;
  jobs: JobRow[];
  events: ScheduleBlockRow[];
  dragging: string | null;
  setDragging: (id: string | null) => void;
  onMove: (id: string, target: Date, hourOverride?: number) => void;
  stageLabelFor: (key: string) => string;
  onCellClick: (start: Date) => void;
}) {
  const hours = Array.from({ length: HOURS_VISIBLE }, (_, i) => HOUR_START + i);
  const start = startOfDay(day).getTime();

  return (
    <div className="max-h-[560px] overflow-y-auto">
      <div className="grid grid-cols-[70px_1fr]">
        {hours.map((h) => {
          const cellDate = new Date(start + h * 3600_000);
          const cellJobs = jobs.filter((j) => {
            const s = new Date(j.scheduledStart!);
            return sameDay(s, day) && s.getHours() === h;
          });
          const cellEvents = events.filter((ev) => {
            const s = new Date(ev.start);
            return sameDay(s, day) && s.getHours() === h;
          });
          return (
            <div key={h} className="contents">
              <div className="border-r border-b bg-muted/20 px-2 py-3 text-xs tabular-nums text-muted-foreground">
                {formatHour(h)}
              </div>
              <div
                className="group relative min-h-[56px] cursor-pointer border-b p-1 hover:bg-accent/20"
                onClick={(e) => {
                  if (e.target === e.currentTarget || e.target === e.currentTarget.firstChild) {
                    onCellClick(cellDate);
                  }
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const id = e.dataTransfer.getData("text/plain") || dragging;
                  if (!id) return;
                  onMove(id, cellDate, h);
                  setDragging(null);
                }}
              >
                <div className="flex flex-col gap-1">
                  {cellJobs.map((j) => (
                    <JobChip
                      key={j.id}
                      job={j}
                      onDragStart={() => setDragging(j.id)}
                      onDragEnd={() => setDragging(null)}
                      stageLabelFor={stageLabelFor}
                    />
                  ))}
                  {cellEvents.map((ev) => (
                    <EventChip key={ev.id} event={ev} />
                  ))}
                </div>
                {cellJobs.length === 0 && cellEvents.length === 0 && (
                  <span className="pointer-events-none absolute inset-0 grid place-items-center text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100">
                    + Add event
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Week view -------------------------------------------------------------

function WeekView({
  rangeStart,
  jobs,
  events,
  dragging,
  setDragging,
  onMove,
  stageLabelFor,
  onCellClick,
}: {
  rangeStart: Date;
  jobs: JobRow[];
  events: ScheduleBlockRow[];
  dragging: string | null;
  setDragging: (id: string | null) => void;
  onMove: (id: string, target: Date) => void;
  stageLabelFor: (key: string) => string;
  onCellClick: (start: Date) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(rangeStart, i));
  const today = new Date();
  return (
    <div className="grid grid-cols-7 divide-x">
      {days.map((d) => {
        const cellJobs = jobs
          .filter((j) => sameDay(new Date(j.scheduledStart!), d))
          .sort(
            (a, b) =>
              new Date(a.scheduledStart!).getTime() - new Date(b.scheduledStart!).getTime(),
          );
        const cellEvents = events
          .filter((ev) => sameDay(new Date(ev.start), d))
          .sort(
            (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
          );
        return (
          <div
            key={d.toISOString()}
            className={cn(
              "group relative min-h-[220px] cursor-pointer p-1 hover:bg-accent/20",
              sameDay(d, today) && "bg-accent/30",
            )}
            onClick={(e) => {
              if (e.target === e.currentTarget) onCellClick(d);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const id = e.dataTransfer.getData("text/plain") || dragging;
              if (!id) return;
              onMove(id, d);
              setDragging(null);
            }}
          >
            <div className="mb-1 flex items-center justify-between px-1 text-[10px] uppercase tracking-widest text-muted-foreground">
              <span>{d.toLocaleDateString(undefined, { weekday: "short" })}</span>
              <span className="tabular-nums">{d.getDate()}</span>
            </div>
            <div className="flex flex-col gap-1">
              {cellJobs.map((j) => (
                <JobChip
                  key={j.id}
                  job={j}
                  onDragStart={() => setDragging(j.id)}
                  onDragEnd={() => setDragging(null)}
                  stageLabelFor={stageLabelFor}
                />
              ))}
              {cellEvents.map((ev) => (
                <EventChip key={ev.id} event={ev} />
              ))}
              {cellJobs.length === 0 && cellEvents.length === 0 && (
                <div className="h-4" /> // dropzone padding
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---- Month view ------------------------------------------------------------

function MonthView({
  rangeStart,
  anchor,
  jobs,
  events,
  dragging,
  setDragging,
  onMove,
  stageLabelFor,
  onCellClick,
}: {
  rangeStart: Date;
  anchor: Date;
  jobs: JobRow[];
  events: ScheduleBlockRow[];
  dragging: string | null;
  setDragging: (id: string | null) => void;
  onMove: (id: string, target: Date) => void;
  stageLabelFor: (key: string) => string;
  onCellClick: (start: Date) => void;
}) {
  const days = Array.from({ length: 42 }, (_, i) => addDays(rangeStart, i));
  const today = new Date();

  return (
    <div>
      <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-1.5">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 divide-x divide-y">
        {days.map((d) => {
          const cellJobs = jobs
            .filter((j) => sameDay(new Date(j.scheduledStart!), d))
            .sort(
              (a, b) =>
                new Date(a.scheduledStart!).getTime() -
                new Date(b.scheduledStart!).getTime(),
            );
          const cellEvents = events
            .filter((ev) => sameDay(new Date(ev.start), d))
            .sort(
              (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
            );
          const outsideMonth = !isSameMonth(d, anchor);
          const totalCount = cellJobs.length + cellEvents.length;
          const overflow = Math.max(0, totalCount - 3);
          const jobsToShow = cellJobs.slice(0, 3);
          const remainingSlots = Math.max(0, 3 - jobsToShow.length);
          const eventsToShow = cellEvents.slice(0, remainingSlots);
          return (
            <div
              key={d.toISOString()}
              className={cn(
                "group relative min-h-[96px] cursor-pointer p-1 hover:bg-accent/20",
                outsideMonth && "bg-muted/20",
                sameDay(d, today) && "bg-accent/40",
              )}
              onClick={(e) => {
                if (e.target === e.currentTarget) onCellClick(d);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const id = e.dataTransfer.getData("text/plain") || dragging;
                if (!id) return;
                onMove(id, d);
                setDragging(null);
              }}
            >
              <div
                className={cn(
                  "mb-0.5 px-1 text-right text-[11px] tabular-nums",
                  outsideMonth ? "text-muted-foreground/50" : "text-muted-foreground",
                )}
              >
                {d.getDate()}
              </div>
              <div className="flex flex-col gap-0.5">
                {jobsToShow.map((j) => (
                  <JobChip
                    key={j.id}
                    job={j}
                    compact
                    onDragStart={() => setDragging(j.id)}
                    onDragEnd={() => setDragging(null)}
                    stageLabelFor={stageLabelFor}
                  />
                ))}
                {eventsToShow.map((ev) => (
                  <EventChip key={ev.id} event={ev} compact />
                ))}
                {overflow > 0 && (
                  <div className="px-1 text-[10px] text-muted-foreground">
                    +{overflow} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Legend ---------------------------------------------------------------

function StageLegend({ stages }: { stages: WorkflowStageRow[] }) {
  // Terminal-only stages (on_hold, canceled) are noise in the legend — they
  // never appear on the timeline itself, only on individual cards.
  const shown = stages.filter(
    (s) => !s.hidden && s.key !== "on_hold" && s.key !== "canceled",
  );
  if (shown.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 border-t bg-muted/20 px-3 py-2 text-[10px]">
      {shown.map((s) => (
        <span key={s.key} className="flex items-center gap-1.5 text-muted-foreground">
          <span className={cn("h-2 w-2 rounded-full", s.dot)} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

// ---- utils -----------------------------------------------------------------

function formatHour(h: number): string {
  const period = h >= 12 ? "PM" : "AM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr} ${period}`;
}

function formatRangeLabel(mode: ViewMode, anchor: Date): string {
  if (mode === "day") {
    return anchor.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }
  if (mode === "week") {
    const s = startOfWeek(anchor);
    const e = addDays(s, 6);
    if (s.getMonth() === e.getMonth()) {
      return `${s.toLocaleDateString(undefined, { month: "long", day: "numeric" })} – ${e.getDate()}, ${e.getFullYear()}`;
    }
    return `${s.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${e.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${e.getFullYear()}`;
  }
  return anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function applyOptimistic(
  job: JobRow,
  overrides: Record<string, { start: Date; end: Date | null }>,
): JobRow {
  const o = overrides[job.id];
  if (!o) return job;
  return {
    ...job,
    scheduledStart: o.start as unknown as JobRow["scheduledStart"],
    scheduledEnd: o.end as unknown as JobRow["scheduledEnd"],
  };
}
