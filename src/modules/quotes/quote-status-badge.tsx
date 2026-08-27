import { Badge } from "@/components/ui/badge";

const TONE: Record<string, string> = {
  draft: "bg-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100",
  sent: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100",
  viewed: "bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-100",
  approved: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100",
  declined: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100",
  expired: "bg-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100",
  revoked: "bg-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100",
};

export function QuoteStatusBadge({ status }: { status: string }) {
  return (
    <Badge className={`text-[10px] uppercase tracking-wide ${TONE[status] ?? TONE.draft}`}>
      {status}
    </Badge>
  );
}
