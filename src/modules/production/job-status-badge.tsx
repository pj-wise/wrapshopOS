import { Badge } from "@/components/ui/badge";

import { jobStageLabel } from "@/lib/production-catalog";

const TONE: Record<string, string> = {
  approved: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
  ready: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100",
  scheduled: "bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-100",
  checked_in: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
  prep: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
  in_progress: "bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100",
  qc: "bg-fuchsia-100 text-fuchsia-900 dark:bg-fuchsia-900/40 dark:text-fuchsia-100",
  ready_for_pickup: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100",
  delivered: "bg-emerald-200 text-emerald-950 dark:bg-emerald-800/60 dark:text-emerald-50",
  on_hold: "bg-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100",
  canceled: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100",
};

export function JobStatusBadge({ status }: { status: string }) {
  return (
    <Badge className={`text-[10px] uppercase tracking-wide ${TONE[status] ?? TONE.approved}`}>
      {jobStageLabel(status)}
    </Badge>
  );
}
