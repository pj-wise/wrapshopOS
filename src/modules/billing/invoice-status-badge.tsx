import { Badge } from "@/components/ui/badge";

const TONE: Record<string, string> = {
  draft: "bg-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100",
  sent: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100",
  viewed: "bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-100",
  partial: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
  paid: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100",
  past_due: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100",
  void: "bg-neutral-200 text-neutral-800 line-through dark:bg-neutral-800 dark:text-neutral-100",
  refunded: "bg-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100",
};

const QBO_TONE: Record<string, string> = {
  synced: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100",
  syncing: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100",
  error: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100",
  disconnected: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
  not_synced: "bg-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100",
};

export function InvoiceStatusBadge({ status }: { status: string }) {
  return (
    <Badge className={`text-[10px] uppercase tracking-wide ${TONE[status] ?? TONE.draft}`}>
      {status.replace("_", " ")}
    </Badge>
  );
}

export function QboSyncBadge({ status }: { status: string }) {
  const label =
    status === "not_synced" ? "not synced" : status;
  return (
    <Badge
      variant="outline"
      className={`text-[10px] uppercase tracking-wide ${QBO_TONE[status] ?? QBO_TONE.not_synced}`}
    >
      QBO · {label}
    </Badge>
  );
}
