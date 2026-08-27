/**
 * Job lifecycle catalog. Kanban columns render in this order.
 * Every mutation that moves a job checks against JOB_STAGES to validate.
 */

export const JOB_STAGES = [
  { key: "approved", label: "Approved", column: "backlog" },
  { key: "ready", label: "Deposit received", column: "backlog" },
  { key: "scheduled", label: "Scheduled", column: "scheduled" },
  { key: "checked_in", label: "Checked in", column: "checked_in" },
  { key: "prep", label: "Prep", column: "prep" },
  { key: "in_progress", label: "In progress", column: "in_progress" },
  { key: "qc", label: "Final inspection", column: "qc" },
  { key: "ready_for_pickup", label: "Ready for pickup", column: "ready" },
  { key: "delivered", label: "Delivered", column: "delivered" },
  { key: "on_hold", label: "On hold", column: "on_hold" },
  { key: "canceled", label: "Canceled", column: "canceled" },
] as const;

export type JobStageKey = (typeof JOB_STAGES)[number]["key"];
export const JOB_STAGE_KEYS = JOB_STAGES.map((s) => s.key);

export function jobStageLabel(key: string): string {
  return JOB_STAGES.find((s) => s.key === key)?.label ?? key;
}

/**
 * Which columns show on the production board (in order left-to-right).
 * Skips canceled + on_hold — those live in a "Held" collapsible section.
 */
export const BOARD_COLUMNS = [
  { key: "backlog", label: "Backlog", stages: ["approved", "ready"] as JobStageKey[] },
  { key: "scheduled", label: "Scheduled", stages: ["scheduled"] as JobStageKey[] },
  { key: "checked_in", label: "Checked in", stages: ["checked_in"] as JobStageKey[] },
  { key: "prep", label: "Prep", stages: ["prep"] as JobStageKey[] },
  { key: "in_progress", label: "Installing", stages: ["in_progress"] as JobStageKey[] },
  { key: "qc", label: "Final inspection", stages: ["qc"] as JobStageKey[] },
  { key: "ready", label: "Ready", stages: ["ready_for_pickup"] as JobStageKey[] },
  { key: "delivered", label: "Delivered", stages: ["delivered"] as JobStageKey[] },
] as const;

export const JOB_PRIORITIES = [
  { key: "low", label: "Low" },
  { key: "normal", label: "Normal" },
  { key: "high", label: "High" },
  { key: "urgent", label: "Urgent" },
] as const;

export type JobPriorityKey = (typeof JOB_PRIORITIES)[number]["key"];

/**
 * Stage-to-tone catalog. Shared by the Kanban card, the calendar chip, the job
 * status badge — anywhere we need a single color that maps to a lifecycle
 * position. Ordered by how far along in the flow the job is.
 */
export const JOB_STAGE_TONES: Record<
  JobStageKey,
  { chip: string; dot: string }
> = {
  approved: {
    dot: "bg-amber-500",
    chip:
      "border-amber-300 bg-amber-100 text-amber-950 dark:border-amber-700/40 dark:bg-amber-500/20 dark:text-amber-100",
  },
  ready: {
    dot: "bg-sky-500",
    chip:
      "border-sky-300 bg-sky-100 text-sky-950 dark:border-sky-700/40 dark:bg-sky-500/20 dark:text-sky-100",
  },
  scheduled: {
    dot: "bg-violet-500",
    chip:
      "border-violet-300 bg-violet-100 text-violet-950 dark:border-violet-700/40 dark:bg-violet-500/20 dark:text-violet-100",
  },
  checked_in: {
    dot: "bg-indigo-500",
    chip:
      "border-indigo-300 bg-indigo-100 text-indigo-950 dark:border-indigo-700/40 dark:bg-indigo-500/20 dark:text-indigo-100",
  },
  prep: {
    dot: "bg-orange-500",
    chip:
      "border-orange-300 bg-orange-100 text-orange-950 dark:border-orange-700/40 dark:bg-orange-500/20 dark:text-orange-100",
  },
  in_progress: {
    dot: "bg-blue-500",
    chip:
      "border-blue-300 bg-blue-100 text-blue-950 dark:border-blue-700/40 dark:bg-blue-500/20 dark:text-blue-100",
  },
  qc: {
    dot: "bg-fuchsia-500",
    chip:
      "border-fuchsia-300 bg-fuchsia-100 text-fuchsia-950 dark:border-fuchsia-700/40 dark:bg-fuchsia-500/20 dark:text-fuchsia-100",
  },
  ready_for_pickup: {
    dot: "bg-emerald-500",
    chip:
      "border-emerald-300 bg-emerald-100 text-emerald-950 dark:border-emerald-700/40 dark:bg-emerald-500/20 dark:text-emerald-100",
  },
  delivered: {
    dot: "bg-green-600",
    chip:
      "border-green-300 bg-green-100 text-green-950 dark:border-green-700/40 dark:bg-green-500/20 dark:text-green-100",
  },
  on_hold: {
    dot: "bg-neutral-500",
    chip:
      "border-neutral-300 bg-neutral-100 text-neutral-800 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100",
  },
  canceled: {
    dot: "bg-red-500",
    chip:
      "border-red-300 bg-red-100 text-red-950 line-through dark:border-red-700/40 dark:bg-red-500/20 dark:text-red-100",
  },
};

export const PHOTO_PHASES = [
  { key: "before", label: "Before" },
  { key: "during", label: "During" },
  { key: "after", label: "After" },
  { key: "delivery", label: "Delivery" },
  { key: "damage", label: "Existing damage" },
  { key: "qc", label: "QC" },
] as const;

export type PhotoPhaseKey = (typeof PHOTO_PHASES)[number]["key"];
