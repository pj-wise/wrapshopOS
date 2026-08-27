"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import {
  EVENT_COLORS,
  EVENT_KINDS,
  HEX_RE,
  paletteAssignmentsFromStages,
  resolveEventTone,
  type EventKindKey,
} from "@/lib/event-catalog";

/**
 * Modal for creating a non-job calendar event: consult / inspection /
 * meeting / other. Users can override the default color per event via the
 * palette swatches.
 *
 * `defaultStart` is passed in when the user opened the dialog by clicking
 * a specific hour/day cell — the form seeds start = that moment, end = +1h.
 * Absent that, defaults to today 9am–10am.
 */
export function NewEventDialog({
  open,
  onOpenChange,
  defaultStart,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultStart?: Date;
  onCreated?: () => void;
}) {
  const create = trpc.schedule.create.useMutation();
  const utils = trpc.useUtils();

  const seedStart = useMemo(() => defaultAt9(defaultStart), [defaultStart]);
  const seedEnd = useMemo(() => new Date(seedStart.getTime() + 60 * 60_000), [seedStart]);

  const [kind, setKind] = useState<EventKindKey>("consult");
  const [title, setTitle] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  /** Either a palette key ("sky") or a hex color ("#f43f5e"), or null for default. */
  const [color, setColor] = useState<string | null>(null);
  const [startLocal, setStartLocal] = useState<string>(toLocalInput(seedStart));
  const [endLocal, setEndLocal] = useState<string>(toLocalInput(seedEnd));

  // Reset whenever the modal re-opens with a new default time.
  useEffect(() => {
    if (!open) return;
    setKind("consult");
    setTitle("");
    setNotes("");
    setColor(null);
    setStartLocal(toLocalInput(seedStart));
    setEndLocal(toLocalInput(seedEnd));
  }, [open, seedStart, seedEnd]);

  // Pull the org's live workflow labels so tooltips say "Deposit received"
  // instead of "Ready" if the shop renamed the stage.
  const workflowQ = trpc.workflow.getStages.useQuery();
  const stageLabelOverrides = useMemo(() => {
    const out: Record<string, string> = {};
    for (const s of workflowQ.data?.stages ?? []) out[s.key] = s.label;
    return out;
  }, [workflowQ.data]);
  const assignments = useMemo(
    () => paletteAssignmentsFromStages(stageLabelOverrides),
    [stageLabelOverrides],
  );

  const tone = resolveEventTone(kind, color);
  const kindMeta = EVENT_KINDS.find((k) => k.key === kind)!;
  const isHex = color != null && HEX_RE.test(color);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const start = fromLocalInput(startLocal);
    const end = fromLocalInput(endLocal);
    if (!start || !end) {
      toast.error("Pick a valid start and end time.");
      return;
    }
    if (end <= start) {
      toast.error("End must be after start.");
      return;
    }
    try {
      await create.mutateAsync({
        kind,
        title: title.trim() || undefined,
        notes: notes.trim() || undefined,
        color,
        start,
        end,
      });
      await utils.schedule.list.invalidate();
      toast.success("Event added.");
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create event");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New event</DialogTitle>
          <DialogDescription>
            Non-job appointments — consults, inspections, meetings — that
            share the calendar with your jobs.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="event-kind">Type</Label>
              <Select
                value={kind}
                onValueChange={(v) => v && setKind(v as EventKindKey)}
              >
                <SelectTrigger id="event-kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_KINDS.map((k) => (
                    <SelectItem key={k.key} value={k.key}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                {kindMeta.description}
              </p>
            </div>
            <div>
              <Label htmlFor="event-title">Label (optional)</Label>
              <Input
                id="event-title"
                placeholder={`e.g. ${defaultTitleFor(kind)}`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="event-start">Starts</Label>
              <Input
                id="event-start"
                type="datetime-local"
                value={startLocal}
                onChange={(e) => setStartLocal(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="event-end">Ends</Label>
              <Input
                id="event-end"
                type="datetime-local"
                value={endLocal}
                onChange={(e) => setEndLocal(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <Label>Color</Label>

            {/* Desktop: swatches with hover tooltips. Small viewports get a
                dropdown listing the same info — easier tap targets, no
                tooltips (hover doesn't work on touch). */}
            <div className="mt-1.5 hidden sm:block">
              <div className="flex flex-wrap items-center gap-2">
                {EVENT_COLORS.map((c) => {
                  const active = (color ?? kindMeta.defaultColor) === c.key;
                  const used = assignments[c.key] ?? [];
                  return (
                    <Tooltip key={c.key}>
                      <TooltipTrigger
                        render={
                          <button
                            type="button"
                            onClick={() => setColor(c.key)}
                            aria-label={c.label}
                            aria-pressed={active}
                            className={cn(
                              "grid h-7 w-7 place-items-center rounded-full border-2 transition-all",
                              active
                                ? "scale-110 border-foreground"
                                : "border-transparent hover:border-muted-foreground/40",
                            )}
                          >
                            <span className={cn("h-4 w-4 rounded-full", c.dot)} />
                          </button>
                        }
                      />
                      <TooltipContent>
                        <div className="font-medium">{c.label}</div>
                        {used.length > 0 ? (
                          <div className="mt-1 text-muted-foreground">
                            Used by: {used.join(", ")}
                          </div>
                        ) : (
                          <div className="mt-1 text-muted-foreground">
                            Not currently used by any stage.
                          </div>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}

                {/* Custom hex picker — inline native <input type="color">. */}
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <label
                        className={cn(
                          "relative grid h-7 w-7 cursor-pointer place-items-center rounded-full border-2 transition-all",
                          isHex
                            ? "scale-110 border-foreground"
                            : "border-transparent hover:border-muted-foreground/40",
                        )}
                        aria-label="Custom color"
                      >
                        <span
                          className="h-4 w-4 rounded-full"
                          style={
                            isHex
                              ? { backgroundColor: color as string }
                              : {
                                  background:
                                    "conic-gradient(from 0deg, #ef4444, #f59e0b, #10b981, #06b6d4, #6366f1, #a855f7, #ef4444)",
                                }
                          }
                        />
                        <input
                          type="color"
                          value={isHex ? (color as string) : "#4f46e5"}
                          onChange={(e) => setColor(e.target.value)}
                          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        />
                      </label>
                    }
                  />
                  <TooltipContent>
                    <div className="font-medium">Custom</div>
                    <div className="mt-1 text-muted-foreground">
                      Pick any hex color from the OS picker.
                    </div>
                  </TooltipContent>
                </Tooltip>

                {color != null && (
                  <button
                    type="button"
                    onClick={() => setColor(null)}
                    className="ml-1 text-xs text-muted-foreground hover:underline"
                  >
                    Reset to default
                  </button>
                )}
              </div>
              {isHex && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Custom hex:{" "}
                  <span className="font-mono">{(color as string).toUpperCase()}</span>
                </div>
              )}
            </div>

            {/* Small viewport variant. */}
            <div className="mt-1.5 space-y-2 sm:hidden">
              <details className="rounded-md border">
                <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="flex items-center gap-2">
                    <span
                      className={cn("h-4 w-4 rounded-full", !isHex && tone.dot)}
                      style={isHex ? tone.dotStyle : undefined}
                    />
                    {isHex
                      ? (color as string).toUpperCase()
                      : EVENT_COLORS.find((c) => c.key === (color ?? kindMeta.defaultColor))
                          ?.label ?? "Color"}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </summary>
                <ul className="max-h-56 overflow-y-auto border-t p-1">
                  {EVENT_COLORS.map((c) => {
                    const used = assignments[c.key] ?? [];
                    const active = (color ?? kindMeta.defaultColor) === c.key;
                    return (
                      <li key={c.key}>
                        <button
                          type="button"
                          onClick={() => setColor(c.key)}
                          className={cn(
                            "flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent",
                            active && "bg-accent/60",
                          )}
                        >
                          <span
                            className={cn("mt-0.5 h-4 w-4 shrink-0 rounded-full", c.dot)}
                          />
                          <span className="min-w-0 flex-1">
                            <div className="font-medium">{c.label}</div>
                            <div className="truncate text-xs text-muted-foreground">
                              {used.length > 0
                                ? `Used by: ${used.join(", ")}`
                                : "Not currently used"}
                            </div>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                  <li className="mt-1 border-t p-2">
                    <label className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Custom hex:</span>
                      <input
                        type="color"
                        value={isHex ? (color as string) : "#4f46e5"}
                        onChange={(e) => setColor(e.target.value)}
                        className="h-7 w-10 cursor-pointer rounded border"
                      />
                      {isHex && (
                        <span className="font-mono text-xs">
                          {(color as string).toUpperCase()}
                        </span>
                      )}
                    </label>
                  </li>
                </ul>
              </details>
              {color != null && (
                <button
                  type="button"
                  onClick={() => setColor(null)}
                  className="text-xs text-muted-foreground hover:underline"
                >
                  Reset to default
                </button>
              )}
            </div>

            <div className="mt-3">
              <div
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium",
                  tone.chip,
                )}
                style={tone.style}
              >
                <span
                  className={cn("h-2 w-2 rounded-full", !isHex && tone.dot)}
                  style={isHex ? tone.dotStyle : undefined}
                />
                {title.trim() || defaultTitleFor(kind)}
              </div>
              <span className="ml-2 text-xs text-muted-foreground">Preview</span>
            </div>
          </div>

          <div>
            <Label htmlFor="event-notes">Notes (optional)</Label>
            <Textarea
              id="event-notes"
              rows={3}
              placeholder="Extra context, contact info, prep instructions…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={create.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add to calendar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---- helpers ---------------------------------------------------------------

function defaultTitleFor(kind: EventKindKey): string {
  return EVENT_KINDS.find((k) => k.key === kind)?.label ?? "Event";
}

/**
 * If no explicit default is passed, seed to today at 9am. If a Date is passed
 * with midnight time (day-cell click in Week/Month view), promote to 9am.
 */
function defaultAt9(seed: Date | undefined): Date {
  const d = seed ? new Date(seed) : new Date();
  if (d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0) {
    d.setHours(9, 0, 0, 0);
  }
  d.setSeconds(0, 0);
  return d;
}

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
