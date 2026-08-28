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
import { EditEventDialog } from "./edit-event-dialog";
import { EditQuoteDialog } from "@/modules/quotes/edit-quote-dialog";

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
  const eventUpdate = trpc.schedule.update.useMutation();
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

  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [eventDefaultStart, setEventDefaultStart] = useState<Date | undefined>(undefined);
  const openEventDialog = (defaultStart?: Date) => {
    setEventDefaultStart(defaultStart);
    setEventDialogOpen(true);
  };
  const [editQuoteId, setEditQuoteId] = useState<string | null>(null);
  const [editEvent, setEditEvent] = useState<ScheduleBlockRow | null>(null);
  const [eventOptimistic, setEventOptimistic] = useState<
    Record<string, { start: Date; end: Date }>
  >({});

  // Non-job schedule events (consult/inspection/meeting/other). Job-tied
  // blocks are already drawn from the jobs list — filter them here so we
  // don't render each scheduled job twice. Overlaid with any in-flight
  // optimistic drag update so chips slide immediately.
  const events = (eventsQ.data ?? [])
    .filter((e) => e.jobId == null && e.kind !== "job")
    .map((e) => {
      const o = eventOptimistic[e.id];
      if (!o) return e;
      return {
        ...e,
        start: o.start as unknown as typeof e.start,
        end: o.end as unknown as typeof e.end,
      };
    });

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

  async function moveEvent(eventId: string, dropTarget: Date, hourOverride?: number) {
    const original = eventsQ.data?.find((e) => e.id === eventId);
    if (!original) return;

    const origStart = new Date(original.start);
    const origEnd = new Date(original.end);
    const durationMs = origEnd.getTime() - origStart.getTime();

    const nextStart = new Date(dropTarget);
    if (hourOverride != null) {
      nextStart.setHours(hourOverride, 0, 0, 0);
    } else {
      nextStart.setHours(origStart.getHours(), origStart.getMinutes(), 0, 0);
    }
    const nextEnd = new Date(nextStart.getTime() + durationMs);

    setEventOptimistic((p) => ({ ...p, [eventId]: { start: nextStart, end: nextEnd } }));
    try {
      await eventUpdate.mutateAsync({
        id: eventId,
        start: nextStart,
        end: nextEnd,
      });
      await utils.schedule.list.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Move failed");
    } finally {
      setEventOptimistic((p) => {
        const next = { ...p };
        delete next[eventId];
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
          onMoveEvent={moveEvent}
          stageLabelFor={stageLabelFor}
          onCellClick={openEventDialog}
          onEditQuote={setEditQuoteId}
          onEditEvent={setEditEvent}
        />
      ) : mode === "week" ? (
        <WeekView
          rangeStart={range.start}
          jobs={jobs}
          events={events}
          dragging={dragging}
          setDragging={setDragging}
          onMove={move}
          onMoveEvent={moveEvent}
          stageLabelFor={stageLabelFor}
          onCellClick={openEventDialog}
          onEditQuote={setEditQuoteId}
          onEditEvent={setEditEvent}
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
          onMoveEvent={moveEvent}
          stageLabelFor={stageLabelFor}
          onCellClick={openEventDialog}
          onEditQuote={setEditQuoteId}
          onEditEvent={setEditEvent}
        />
      )}

      <StageLegend stages={workflow} />

      <NewEventDialog
        open={eventDialogOpen}
        onOpenChange={setEventDialogOpen}
        defaultStart={eventDefaultStart}
      />

      <EditQuoteDialog
        open={!!editQuoteId}
        onOpenChange={(v) => !v && setEditQuoteId(null)}
        quoteId={editQuoteId}
      />

      <EditEventDialog
        open={!!editEvent}
        onOpenChange={(v) => !v && setEditEvent(null)}
        event={editEvent}
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
  onEdit,
}: {
  job: JobRow;
  onDragStart: () => void;
  onDragEnd: () => void;
  compact?: boolean;
  stageLabelFor: (key: string) => string;
  onEdit: (quoteId: string) => void;
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
  const hasQuote = Boolean(job.quote);
  const commonClass = cn(
    "group flex cursor-grab items-center gap-1.5 truncate rounded-md border px-1.5 py-0.5 text-[11px] font-medium text-left w-full active:cursor-grabbing",
    tone.chip,
  );
  const label = (
    <>
      <GripVertical className="h-2.5 w-2.5 opacity-40 group-hover:opacity-100" />
      <span className="truncate">
        {!compact && timeLabel ? `${timeLabel} · ` : ""}
        {title}
      </span>
    </>
  );

  if (!hasQuote) {
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
        className={commonClass}
        title={`${title} · ${stageLabelFor(job.status)}${timeLabel ? ` · ${timeLabel}` : ""}`}
      >
        {label}
      </Link>
    );
  }

  return (
    <button
      type="button"
      draggable
      onClick={(e) => {
        e.stopPropagation();
        onEdit(job.quote!.id);
      }}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", job.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={commonClass}
      title={`${title} · ${stageLabelFor(job.status)}${timeLabel ? ` · ${timeLabel}` : ""}`}
    >
      {label}
    </button>
  );
}

/**
 * Prefix events with `event:` when set on the drag dataTransfer so the drop
 * handler can distinguish an event drag from a job drag (jobs use the bare
 * id). Keeps the two entity types on independent update paths.
 */
const EVENT_DRAG_PREFIX = "event:";

/** Parse a calendar drop payload into { kind, id }. Returns null when empty. */
function parseDropPayload(
  raw: string | null,
): { kind: "job" | "event"; id: string } | null {
  if (!raw) return null;
  if (raw.startsWith(EVENT_DRAG_PREFIX)) {
    return { kind: "event", id: raw.slice(EVENT_DRAG_PREFIX.length) };
  }
  return { kind: "job", id: raw };
}

function EventChip({
  event,
  compact,
  onDragStart,
  onDragEnd,
  onEdit,
}: {
  event: ScheduleBlockRow;
  compact?: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onEdit: (event: ScheduleBlockRow) => void;
}) {
  const tone = resolveEventTone(event.kind, event.color);
  const title = event.title?.trim() || eventKindLabel(event.kind);
  const start = new Date(event.start);
  const timeLabel = start.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", `${EVENT_DRAG_PREFIX}${event.id}`);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={(e) => {
        e.stopPropagation();
        onEdit(event);
      }}
      className={cn(
        "group flex w-full cursor-grab items-center gap-1.5 truncate rounded-md border px-1.5 py-0.5 text-left text-[11px] font-medium active:cursor-grabbing",
        tone.chip,
      )}
      style={tone.style}
      title={`${title} · ${eventKindLabel(event.kind)} · ${timeLabel}`}
    >
      <GripVertical className="h-2.5 w-2.5 shrink-0 opacity-40 group-hover:opacity-100" />
      <span
        className={cn("h-2 w-2 shrink-0 rounded-full", tone.dot)}
        style={tone.dotStyle}
      />
      <span className="truncate">
        {!compact ? `${timeLabel} · ` : ""}
        {title}
      </span>
    </button>
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
  onMoveEvent,
  stageLabelFor,
  onCellClick,
  onEditQuote,
  onEditEvent,
}: {
  day: Date;
  jobs: JobRow[];
  events: ScheduleBlockRow[];
  dragging: string | null;
  setDragging: (id: string | null) => void;
  onMove: (id: string, target: Date, hourOverride?: number) => void;
  onMoveEvent: (id: string, target: Date, hourOverride?: number) => void;
  stageLabelFor: (key: string) => string;
  onCellClick: (start: Date) => void;
  onEditQuote: (quoteId: string) => void;
  onEditEvent: (event: ScheduleBlockRow) => void;
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
                  const payload = parseDropPayload(
                    e.dataTransfer.getData("text/plain") || dragging,
                  );
                  if (!payload) return;
                  if (payload.kind === "event") onMoveEvent(payload.id, cellDate, h);
                  else onMove(payload.id, cellDate, h);
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
                      onEdit={onEditQuote}
                    />
                  ))}
                  {cellEvents.map((ev) => (
                    <EventChip
                      key={ev.id}
                      event={ev}
                      onDragStart={() => setDragging(ev.id)}
                      onDragEnd={() => setDragging(null)}
                      onEdit={onEditEvent}
                    />
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

/**
 * Multi-day chip spanning:
 *   - Each job/event's date range is projected onto a 7-column week grid.
 *   - Chips are placed with `grid-column: startCol / endCol+1` so a 3-day
 *     job renders as one wide pill instead of one chip per day.
 *   - Greedy lane assignment stacks overlapping chips into separate rows.
 *   - Day backgrounds sit on `grid-row: 2 / -1` so drops still fire on the
 *     empty portions of each column while chips overlay them for clicks.
 */
type SpanEntry =
  | { kind: "job"; id: string; startCol: number; endCol: number; job: JobRow; startMs: number; spanDays: number }
  | { kind: "event"; id: string; startCol: number; endCol: number; event: ScheduleBlockRow; startMs: number; spanDays: number };

function projectToCols(
  startDate: Date,
  endDate: Date,
  rangeStartMs: number,
  totalDays: number,
): { startCol: number; endCol: number } | null {
  const rangeEndMs = rangeStartMs + totalDays * DAY_MS;
  if (endDate.getTime() < rangeStartMs || startDate.getTime() >= rangeEndMs) return null;
  const startCol = Math.floor(
    (startOfDay(new Date(Math.max(startDate.getTime(), rangeStartMs))).getTime() -
      rangeStartMs) /
      DAY_MS,
  );
  // End is exclusive at midnight — subtract 1ms so an all-day event ending at
  // 00:00 next day doesn't spill into the following column.
  const endCol = Math.floor(
    (startOfDay(new Date(Math.min(endDate.getTime(), rangeEndMs) - 1)).getTime() -
      rangeStartMs) /
      DAY_MS,
  );
  return {
    startCol: Math.max(0, Math.min(totalDays - 1, startCol)),
    endCol: Math.max(0, Math.min(totalDays - 1, Math.max(startCol, endCol))),
  };
}

function buildSpans(
  jobs: JobRow[],
  events: ScheduleBlockRow[],
  rangeStart: Date,
  totalDays: number,
): SpanEntry[] {
  const rangeStartMs = rangeStart.getTime();
  const spans: SpanEntry[] = [];
  for (const j of jobs) {
    if (!j.scheduledStart) continue;
    const start = new Date(j.scheduledStart);
    const end = j.scheduledEnd ? new Date(j.scheduledEnd) : new Date(start.getTime() + 60 * 60_000);
    const cols = projectToCols(start, end, rangeStartMs, totalDays);
    if (!cols) continue;
    spans.push({
      kind: "job",
      id: j.id,
      startCol: cols.startCol,
      endCol: cols.endCol,
      job: j,
      startMs: start.getTime(),
      spanDays: cols.endCol - cols.startCol + 1,
    });
  }
  for (const ev of events) {
    const start = new Date(ev.start);
    const end = new Date(ev.end);
    const cols = projectToCols(start, end, rangeStartMs, totalDays);
    if (!cols) continue;
    spans.push({
      kind: "event",
      id: ev.id,
      startCol: cols.startCol,
      endCol: cols.endCol,
      event: ev,
      startMs: start.getTime(),
      spanDays: cols.endCol - cols.startCol + 1,
    });
  }
  // Sort so longer-span chips get first pick of low lanes — makes the visual
  // layout more compact when short chips can fill leftover gaps.
  spans.sort((a, b) => a.startCol - b.startCol || b.spanDays - a.spanDays || a.startMs - b.startMs);
  return spans;
}

function assignLanes(spans: SpanEntry[]): { lane: number[]; totalLanes: number } {
  const laneEnds: number[] = [];
  const lane: number[] = spans.map((s) => {
    for (let i = 0; i < laneEnds.length; i++) {
      if (laneEnds[i] < s.startCol) {
        laneEnds[i] = s.endCol;
        return i;
      }
    }
    laneEnds.push(s.endCol);
    return laneEnds.length - 1;
  });
  return { lane, totalLanes: Math.max(1, laneEnds.length) };
}

function WeekView({
  rangeStart,
  jobs,
  events,
  dragging,
  setDragging,
  onMove,
  onMoveEvent,
  stageLabelFor,
  onCellClick,
  onEditQuote,
  onEditEvent,
}: {
  rangeStart: Date;
  jobs: JobRow[];
  events: ScheduleBlockRow[];
  dragging: string | null;
  setDragging: (id: string | null) => void;
  onMove: (id: string, target: Date) => void;
  onMoveEvent: (id: string, target: Date) => void;
  stageLabelFor: (key: string) => string;
  onCellClick: (start: Date) => void;
  onEditQuote: (quoteId: string) => void;
  onEditEvent: (event: ScheduleBlockRow) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(rangeStart, i));
  const today = new Date();
  const spans = buildSpans(jobs, events, rangeStart, 7);
  const { lane, totalLanes } = assignLanes(spans);

  return (
    <div
      className="grid gap-y-1"
      style={{
        gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
        gridTemplateRows: `auto repeat(${totalLanes}, minmax(0, auto)) 1fr`,
      }}
    >
      {/* Row 1: day headers */}
      {days.map((d, i) => (
        <div
          key={`h-${d.toISOString()}`}
          style={{ gridColumn: i + 1, gridRow: 1 }}
          className={cn(
            "flex items-center justify-between border-b border-l px-2 py-1 text-[10px] uppercase tracking-widest text-muted-foreground",
            i === 0 && "border-l-0",
            sameDay(d, today) && "bg-accent/30",
          )}
        >
          <span>{d.toLocaleDateString(undefined, { weekday: "short" })}</span>
          <span className="tabular-nums">{d.getDate()}</span>
        </div>
      ))}

      {/* Backgrounds — one per column, spanning every chip row + trailing filler */}
      {days.map((d, i) => (
        <div
          key={`bg-${d.toISOString()}`}
          style={{ gridColumn: i + 1, gridRow: `2 / -1` }}
          className={cn(
            "min-h-[220px] cursor-pointer border-l hover:bg-accent/10",
            i === 0 && "border-l-0",
            sameDay(d, today) && "bg-accent/20",
          )}
          onClick={(e) => {
            if (e.target === e.currentTarget) onCellClick(d);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            const payload = parseDropPayload(
              e.dataTransfer.getData("text/plain") || dragging,
            );
            if (!payload) return;
            if (payload.kind === "event") onMoveEvent(payload.id, d);
            else onMove(payload.id, d);
            setDragging(null);
          }}
        />
      ))}

      {/* Spanning chips */}
      {spans.map((s, i) => (
        <div
          key={s.id}
          style={{
            gridColumnStart: s.startCol + 1,
            gridColumnEnd: s.endCol + 2,
            gridRow: lane[i] + 2,
          }}
          className="min-w-0 px-1"
        >
          {s.kind === "job" ? (
            <JobChip
              job={s.job}
              onDragStart={() => setDragging(s.job.id)}
              onDragEnd={() => setDragging(null)}
              stageLabelFor={stageLabelFor}
              onEdit={onEditQuote}
            />
          ) : (
            <EventChip
              event={s.event}
              onDragStart={() => setDragging(s.event.id)}
              onDragEnd={() => setDragging(null)}
              onEdit={onEditEvent}
            />
          )}
        </div>
      ))}
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
  onMoveEvent,
  stageLabelFor,
  onCellClick,
  onEditQuote,
  onEditEvent,
}: {
  rangeStart: Date;
  anchor: Date;
  jobs: JobRow[];
  events: ScheduleBlockRow[];
  dragging: string | null;
  setDragging: (id: string | null) => void;
  onMove: (id: string, target: Date) => void;
  onMoveEvent: (id: string, target: Date) => void;
  stageLabelFor: (key: string) => string;
  onCellClick: (start: Date) => void;
  onEditQuote: (quoteId: string) => void;
  onEditEvent: (event: ScheduleBlockRow) => void;
}) {
  // 6 week rows × 7 days. Each row is its own mini-grid that spans chips
  // horizontally the same way WeekView does.
  const weekStarts = Array.from({ length: 6 }, (_, i) => addDays(rangeStart, i * 7));

  return (
    <div>
      <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-1.5">
            {d}
          </div>
        ))}
      </div>
      {weekStarts.map((weekStart) => (
        <MonthWeekRow
          key={weekStart.toISOString()}
          weekStart={weekStart}
          anchor={anchor}
          jobs={jobs}
          events={events}
          dragging={dragging}
          setDragging={setDragging}
          onMove={onMove}
          onMoveEvent={onMoveEvent}
          stageLabelFor={stageLabelFor}
          onCellClick={onCellClick}
          onEditQuote={onEditQuote}
          onEditEvent={onEditEvent}
        />
      ))}
    </div>
  );
}

function MonthWeekRow({
  weekStart,
  anchor,
  jobs,
  events,
  dragging,
  setDragging,
  onMove,
  onMoveEvent,
  stageLabelFor,
  onCellClick,
  onEditQuote,
  onEditEvent,
}: {
  weekStart: Date;
  anchor: Date;
  jobs: JobRow[];
  events: ScheduleBlockRow[];
  dragging: string | null;
  setDragging: (id: string | null) => void;
  onMove: (id: string, target: Date) => void;
  onMoveEvent: (id: string, target: Date) => void;
  stageLabelFor: (key: string) => string;
  onCellClick: (start: Date) => void;
  onEditQuote: (quoteId: string) => void;
  onEditEvent: (event: ScheduleBlockRow) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date();
  const spans = buildSpans(jobs, events, weekStart, 7);
  const { lane, totalLanes } = assignLanes(spans);
  // Cap visible lanes to keep month cells short; extras collapse into a
  // "+N more" indicator per day.
  const MAX_LANES = 3;
  const shownSpans = spans.filter((_, i) => lane[i] < MAX_LANES);
  const shownLaneCount = Math.min(totalLanes, MAX_LANES);

  // Count hidden per day for the "+N more" hint.
  const hiddenPerCol = new Array(7).fill(0) as number[];
  for (let i = 0; i < spans.length; i++) {
    if (lane[i] >= MAX_LANES) {
      for (let c = spans[i].startCol; c <= spans[i].endCol; c++) hiddenPerCol[c]++;
    }
  }

  return (
    <div
      className="grid border-t"
      style={{
        gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
        gridTemplateRows: `auto repeat(${shownLaneCount}, minmax(0, auto)) auto`,
      }}
    >
      {/* Row 1: date labels */}
      {days.map((d, i) => {
        const outsideMonth = !isSameMonth(d, anchor);
        return (
          <div
            key={`h-${d.toISOString()}`}
            style={{ gridColumn: i + 1, gridRow: 1 }}
            className={cn(
              "border-l px-1 pt-0.5 text-right text-[11px] tabular-nums",
              i === 0 && "border-l-0",
              outsideMonth ? "text-muted-foreground/50" : "text-muted-foreground",
              sameDay(d, today) && "font-semibold text-foreground",
            )}
          >
            {d.getDate()}
          </div>
        );
      })}
      {/* Backgrounds */}
      {days.map((d, i) => {
        const outsideMonth = !isSameMonth(d, anchor);
        return (
          <div
            key={`bg-${d.toISOString()}`}
            style={{ gridColumn: i + 1, gridRow: `2 / -1` }}
            className={cn(
              "min-h-[96px] cursor-pointer border-l hover:bg-accent/20",
              i === 0 && "border-l-0",
              outsideMonth && "bg-muted/20",
              sameDay(d, today) && "bg-accent/30",
            )}
            onClick={(e) => {
              if (e.target === e.currentTarget) onCellClick(d);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const payload = parseDropPayload(
                e.dataTransfer.getData("text/plain") || dragging,
              );
              if (!payload) return;
              if (payload.kind === "event") onMoveEvent(payload.id, d);
              else onMove(payload.id, d);
              setDragging(null);
            }}
          />
        );
      })}
      {/* Spanning chips */}
      {shownSpans.map((s) => {
        const originalIdx = spans.indexOf(s);
        return (
          <div
            key={s.id}
            style={{
              gridColumnStart: s.startCol + 1,
              gridColumnEnd: s.endCol + 2,
              gridRow: lane[originalIdx] + 2,
            }}
            className="min-w-0 px-0.5"
          >
            {s.kind === "job" ? (
              <JobChip
                job={s.job}
                compact
                onDragStart={() => setDragging(s.job.id)}
                onDragEnd={() => setDragging(null)}
                stageLabelFor={stageLabelFor}
                onEdit={onEditQuote}
              />
            ) : (
              <EventChip
                event={s.event}
                compact
                onDragStart={() => setDragging(s.event.id)}
                onDragEnd={() => setDragging(null)}
                onEdit={onEditEvent}
              />
            )}
          </div>
        );
      })}
      {/* Per-day "+N more" hints in the final row */}
      {hiddenPerCol.map((n, i) =>
        n > 0 ? (
          <div
            key={`ov-${i}`}
            style={{ gridColumn: i + 1, gridRow: shownLaneCount + 2 }}
            className="px-1 pb-0.5 text-[10px] text-muted-foreground"
          >
            +{n} more
          </div>
        ) : null,
      )}
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
