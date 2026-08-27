"use client";

import { useEffect, useMemo, useState } from "react";
import { GripVertical, Eye, EyeOff, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc/client";
import { JOB_STAGES, type JobStageKey } from "@/lib/production-catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Zapier-style horizontal timeline. Each stage is a pill. Drag pills to
 * reorder, click the label to rename, click the eye icon to hide/show.
 * "Save" persists to Organization.settings.workflow.jobStages.
 */

type StageState = {
  key: JobStageKey;
  label: string;
  defaultLabel: string;
  chip: string;
  dot: string;
  hidden: boolean;
};

export function WorkflowSettings() {
  const q = trpc.workflow.getStages.useQuery();
  const save = trpc.workflow.saveStages.useMutation();
  const reset = trpc.workflow.resetStages.useMutation();
  const utils = trpc.useUtils();

  const [stages, setStages] = useState<StageState[] | null>(null);
  const [dragKey, setDragKey] = useState<JobStageKey | null>(null);
  const [overKey, setOverKey] = useState<JobStageKey | null>(null);

  useEffect(() => {
    if (!q.data) return;
    const defaults = new Map(JOB_STAGES.map((s) => [s.key, s.label]));
    setStages(
      q.data.stages.map((s) => ({
        key: s.key,
        label: s.label,
        defaultLabel: defaults.get(s.key) ?? s.label,
        chip: s.chip,
        dot: s.dot,
        hidden: !!s.hidden,
      })),
    );
  }, [q.data]);

  const dirty = useMemo(() => {
    if (!q.data || !stages) return false;
    if (stages.length !== q.data.stages.length) return true;
    for (let i = 0; i < stages.length; i++) {
      const a = stages[i];
      const b = q.data.stages[i];
      if (a.key !== b.key) return true;
      if (a.label !== b.label) return true;
      if (!!a.hidden !== !!b.hidden) return true;
    }
    return false;
  }, [q.data, stages]);

  function move(from: number, to: number) {
    if (!stages) return;
    if (to < 0 || to >= stages.length) return;
    const next = stages.slice();
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setStages(next);
  }

  function onDragStart(e: React.DragEvent, key: JobStageKey) {
    setDragKey(key);
    e.dataTransfer.effectAllowed = "move";
    // Firefox requires setData to initiate drag.
    e.dataTransfer.setData("text/plain", key);
  }
  function onDragOver(e: React.DragEvent, key: JobStageKey) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragKey && key !== overKey) setOverKey(key);
  }
  function onDrop(e: React.DragEvent, key: JobStageKey) {
    e.preventDefault();
    if (!stages || !dragKey || dragKey === key) {
      setDragKey(null);
      setOverKey(null);
      return;
    }
    const from = stages.findIndex((s) => s.key === dragKey);
    const to = stages.findIndex((s) => s.key === key);
    if (from < 0 || to < 0) return;
    move(from, to);
    setDragKey(null);
    setOverKey(null);
  }
  function onDragEnd() {
    setDragKey(null);
    setOverKey(null);
  }

  async function onSave() {
    if (!stages) return;
    try {
      await save.mutateAsync({
        stages: stages.map((s) => ({
          key: s.key,
          label: s.label.trim() === s.defaultLabel ? undefined : s.label.trim(),
          hidden: s.hidden || undefined,
        })),
      });
      await utils.workflow.getStages.invalidate();
      toast.success("Workflow saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function onReset() {
    try {
      await reset.mutateAsync();
      await utils.workflow.getStages.invalidate();
      toast.success("Reverted to default workflow.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed");
    }
  }

  if (q.isLoading || !stages) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Job workflow</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Drag stages to reorder them. Rename any stage to match how your shop
          talks about it. Hidden stages still exist in the database but do not
          appear on the Kanban or calendar.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Timeline
          </div>
          <div className="text-xs text-muted-foreground">
            {q.data?.hasOverride ? "Custom workflow" : "Default workflow"}
          </div>
        </div>

        <div
          className="flex flex-wrap items-center gap-2"
          onDragOver={(e) => e.preventDefault()}
        >
          {stages.map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              <StagePill
                stage={s}
                index={i}
                isDragging={dragKey === s.key}
                isOver={overKey === s.key && dragKey !== s.key}
                onDragStart={(e) => onDragStart(e, s.key)}
                onDragOver={(e) => onDragOver(e, s.key)}
                onDrop={(e) => onDrop(e, s.key)}
                onDragEnd={onDragEnd}
                onRename={(label) =>
                  setStages((prev) =>
                    prev
                      ? prev.map((p) =>
                          p.key === s.key ? { ...p, label } : p,
                        )
                      : prev,
                  )
                }
                onToggleHidden={() =>
                  setStages((prev) =>
                    prev
                      ? prev.map((p) =>
                          p.key === s.key ? { ...p, hidden: !p.hidden } : p,
                        )
                      : prev,
                  )
                }
              />
              {i < stages.length - 1 && (
                <div className="h-px w-6 bg-border" aria-hidden />
              )}
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Tip: the stage <span className="font-medium">keys</span> are baked
          into the platform (they drive automations and reports) — you can
          reorder and relabel, but you can&apos;t invent new ones or delete
          them. Hide the ones you don&apos;t use.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={onReset}
          disabled={!q.data?.hasOverride || reset.isPending}
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset to defaults
        </Button>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => q.refetch()}
            disabled={!dirty || save.isPending}
          >
            Discard changes
          </Button>
          <Button type="button" onClick={onSave} disabled={!dirty || save.isPending}>
            {save.isPending ? "Saving…" : "Save workflow"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function StagePill({
  stage,
  index: _index,
  isDragging,
  isOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onRename,
  onToggleHidden,
}: {
  stage: StageState;
  index: number;
  isDragging: boolean;
  isOver: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onRename: (label: string) => void;
  onToggleHidden: () => void;
}) {
  void _index;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(stage.label);

  useEffect(() => {
    setDraft(stage.label);
  }, [stage.label]);

  function commit() {
    const next = draft.trim() || stage.defaultLabel;
    onRename(next);
    setEditing(false);
  }

  return (
    <div
      draggable={!editing}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={cn(
        "group relative inline-flex items-center gap-1.5 rounded-full border pl-1.5 pr-2 py-1 text-sm transition-all",
        stage.chip,
        stage.hidden && "opacity-40",
        isDragging && "opacity-30",
        isOver && "ring-2 ring-ring ring-offset-2 ring-offset-background",
      )}
    >
      <button
        type="button"
        aria-label="Drag to reorder"
        className="cursor-grab text-current/60 hover:text-current active:cursor-grabbing"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <span
        className={cn("inline-block h-2 w-2 rounded-full", stage.dot)}
        aria-hidden
      />
      {editing ? (
        <Input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              setDraft(stage.label);
              setEditing(false);
            }
          }}
          className="h-6 w-32 border-0 bg-transparent px-1 py-0 text-sm focus-visible:ring-0"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="cursor-text font-medium"
          title={`Key: ${stage.key}`}
        >
          {stage.label}
        </button>
      )}
      <button
        type="button"
        onClick={onToggleHidden}
        aria-label={stage.hidden ? "Show stage" : "Hide stage"}
        className="ml-1 text-current/60 hover:text-current"
        title={stage.hidden ? "Show on Kanban" : "Hide from Kanban"}
      >
        {stage.hidden ? (
          <EyeOff className="h-3.5 w-3.5" />
        ) : (
          <Eye className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}
