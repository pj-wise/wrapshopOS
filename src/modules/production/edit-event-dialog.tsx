"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import {
  EVENT_COLORS,
  EVENT_KINDS,
  HEX_RE,
  resolveEventTone,
  type EventKindKey,
} from "@/lib/event-catalog";
import type { RouterOutputs } from "@/lib/trpc/types";

type EventRow = RouterOutputs["schedule"]["list"][number];

/**
 * Edit an existing calendar event. Same shape as `NewEventDialog` but
 * trimmed to the fields users actually retouch on a scheduled event —
 * type, label, color, time window, and notes. Includes a Delete action.
 *
 * On save we call `schedule.update`, then invalidate `schedule.list` and
 * `jobs.list` (the calendar reads both). Delete uses `ConfirmDialog`.
 */
export function EditEventDialog({
  open,
  onOpenChange,
  event,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: EventRow | null;
}) {
  const update = trpc.schedule.update.useMutation();
  const del = trpc.schedule.delete.useMutation();
  const utils = trpc.useUtils();

  const [kind, setKind] = useState<EventKindKey>("consult");
  const [title, setTitle] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [color, setColor] = useState<string | null>(null);
  const [startLocal, setStartLocal] = useState<string>("");
  const [endLocal, setEndLocal] = useState<string>("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open || !event) return;
    setKind(coerceKind(event.kind));
    setTitle(event.title ?? "");
    setNotes(event.notes ?? "");
    setColor(event.color ?? null);
    setStartLocal(toLocalInput(new Date(event.start)));
    setEndLocal(toLocalInput(new Date(event.end)));
  }, [open, event]);

  const tone = resolveEventTone(kind, color);
  const kindMeta = useMemo(
    () => EVENT_KINDS.find((k) => k.key === kind) ?? EVENT_KINDS[0],
    [kind],
  );
  const isHex = color != null && HEX_RE.test(color);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!event) return;
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
      await update.mutateAsync({
        id: event.id,
        kind,
        title: title.trim() || undefined,
        notes: notes.trim() || undefined,
        color,
        start,
        end,
      });
      await utils.schedule.list.invalidate();
      toast.success("Event updated.");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function onDelete() {
    if (!event) return;
    try {
      await del.mutateAsync({ id: event.id });
      await utils.schedule.list.invalidate();
      toast.success("Event deleted.");
      setConfirmDelete(false);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
      throw err;
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit event</DialogTitle>
            <DialogDescription>
              Adjust type, timing, color, or notes. Delete removes the event
              from the calendar.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="edit-event-kind">Type</Label>
                <Select
                  value={kind}
                  onValueChange={(v) => v && setKind(v as EventKindKey)}
                >
                  <SelectTrigger id="edit-event-kind" className="w-full">
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
                <Label htmlFor="edit-event-title">Label</Label>
                <Input
                  id="edit-event-title"
                  placeholder={kindMeta.label}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="edit-event-start">Starts</Label>
                <Input
                  id="edit-event-start"
                  type="datetime-local"
                  value={startLocal}
                  onChange={(e) => setStartLocal(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-event-end">Ends</Label>
                <Input
                  id="edit-event-end"
                  type="datetime-local"
                  value={endLocal}
                  onChange={(e) => setEndLocal(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <Label>Color</Label>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {EVENT_COLORS.map((c) => {
                  const active = (color ?? kindMeta.defaultColor) === c.key;
                  return (
                    <button
                      key={c.key}
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
                      title={c.label}
                    >
                      <span className={cn("h-4 w-4 rounded-full", c.dot)} />
                    </button>
                  );
                })}
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
                  {title.trim() || kindMeta.label}
                </div>
                <span className="ml-2 text-xs text-muted-foreground">Preview</span>
              </div>
            </div>

            <div>
              <Label htmlFor="edit-event-notes">Notes</Label>
              <Textarea
                id="edit-event-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <DialogFooter className="justify-between sm:justify-between">
              <Button
                type="button"
                variant="destructive"
                onClick={() => setConfirmDelete(true)}
                disabled={update.isPending || del.isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  disabled={update.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={update.isPending}>
                  {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save changes
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this event?"
        description="This removes the event from the calendar. Timeline entries are preserved."
        confirmLabel="Delete event"
        onConfirm={onDelete}
      />
    </>
  );
}

// -----------------------------------------------------------------------------

function coerceKind(raw: string): EventKindKey {
  if (EVENT_KINDS.some((k) => k.key === raw)) return raw as EventKindKey;
  return "other";
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
