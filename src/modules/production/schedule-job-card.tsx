"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Prominent scheduling card shown on the Job detail page when a job is
 * approved / deposit-received but hasn't been dropped onto the calendar
 * yet. Two datetime-local inputs (start + end) + Save. Saving flips the
 * job's status to `scheduled` in the same mutation.
 *
 * End defaults to `start + estimatedHours` (falling back to +2h) so the
 * common case is one date pick and one click. The estimate seed only fires
 * on first mount; user-picked end times are preserved when start changes.
 */
export function ScheduleJobCard({
  jobId,
  jobNumber,
  estimatedHours,
}: {
  jobId: string;
  jobNumber: number;
  /** Numeric (or Prisma Decimal `.toString()`) hours estimate, if any. */
  estimatedHours: number | string | null | undefined;
}) {
  const update = trpc.jobs.update.useMutation();
  const utils = trpc.useUtils();

  const defaultStart = useMemo(() => nextBusinessSlot(new Date()), []);
  const estMs = useMemo(() => {
    const n = estimatedHours != null ? Number(estimatedHours) : NaN;
    return Number.isFinite(n) && n > 0 ? n * 3600_000 : 2 * 3600_000;
  }, [estimatedHours]);

  const [startLocal, setStartLocal] = useState<string>(toLocalInput(defaultStart));
  const [endLocal, setEndLocal] = useState<string>(
    toLocalInput(new Date(defaultStart.getTime() + estMs)),
  );
  /** True until the user manually edits `end`. Lets Start-changes drag End along. */
  const [autoEnd, setAutoEnd] = useState(true);

  useEffect(() => {
    if (!autoEnd) return;
    const s = fromLocalInput(startLocal);
    if (!s) return;
    setEndLocal(toLocalInput(new Date(s.getTime() + estMs)));
  }, [startLocal, autoEnd, estMs]);

  async function onSave() {
    const start = fromLocalInput(startLocal);
    const end = fromLocalInput(endLocal);
    if (!start) {
      toast.error("Pick a start date + time.");
      return;
    }
    if (!end) {
      toast.error("Pick an end date + time.");
      return;
    }
    if (end <= start) {
      toast.error("End must be after start.");
      return;
    }
    try {
      await update.mutateAsync({
        id: jobId,
        scheduledStart: start,
        scheduledEnd: end,
        status: "scheduled",
      });
      await Promise.all([
        utils.jobs.get.invalidate({ id: jobId }),
        utils.jobs.pendingScheduling.invalidate(),
        utils.jobs.list.invalidate(),
      ]);
      toast.success(`J-${String(jobNumber).padStart(4, "0")} scheduled.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  }

  const durationMinutes = useMemo(() => {
    const s = fromLocalInput(startLocal);
    const e = fromLocalInput(endLocal);
    if (!s || !e || e <= s) return null;
    return Math.round((e.getTime() - s.getTime()) / 60_000);
  }, [startLocal, endLocal]);

  return (
    <section className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700/40 dark:bg-amber-500/10">
      <div className="mb-3 flex items-start gap-2">
        <CalendarClock className="mt-0.5 h-4 w-4 text-amber-700 dark:text-amber-200" />
        <div>
          <h3 className="text-sm font-semibold text-amber-950 dark:text-amber-100">
            Schedule this job
          </h3>
          <p className="text-xs text-amber-900/80 dark:text-amber-100/80">
            Pick a start and end for the work. Saving moves the job into Scheduled
            and drops it onto the calendar.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="job-start" className="text-xs">
            Start
          </Label>
          <Input
            id="job-start"
            type="datetime-local"
            value={startLocal}
            onChange={(e) => setStartLocal(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="job-end" className="text-xs">
            End
          </Label>
          <Input
            id="job-end"
            type="datetime-local"
            value={endLocal}
            onChange={(e) => {
              setAutoEnd(false);
              setEndLocal(e.target.value);
            }}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-900/80 dark:text-amber-100/80">
        <span>
          {durationMinutes != null
            ? `Duration ${formatDuration(durationMinutes)}${
                estimatedHours ? ` · est ${Number(estimatedHours).toFixed(1)}h` : ""
              }`
            : "Duration —"}
        </span>
        <Button type="button" size="sm" onClick={onSave} disabled={update.isPending}>
          {update.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
          Schedule job
        </Button>
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
function toLocalInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Round `now` up to the next 9am or 1pm slot on a weekday (skip weekends). */
function nextBusinessSlot(from: Date): Date {
  const d = new Date(from);
  d.setSeconds(0, 0);
  d.setMinutes(0);
  d.setHours(d.getHours() + 1); // at least an hour in the future
  if (d.getHours() < 9) d.setHours(9);
  else if (d.getHours() >= 17) {
    d.setDate(d.getDate() + 1);
    d.setHours(9);
  }
  // Skip Saturday/Sunday.
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d;
}

function formatDuration(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
