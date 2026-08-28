import { Badge } from "@/components/ui/badge";

const TONE: Record<string, string> = {
  draft: "bg-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100",
  sent: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100",
  viewed: "bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-100",
  approved: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100",
  declined: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100",
  // Deliberately louder than the DB `revoked` badge — an unresolved
  // expired quote is something a shop needs to actually act on.
  expired:
    "bg-amber-200 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100 border border-amber-400/60 dark:border-amber-500/40",
  revoked: "bg-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100",
};

/**
 * Derived "expired" status: any quote whose `expiresAt` is in the past AND
 * whose DB status hasn't already moved to a terminal state (`approved`,
 * `declined`, `revoked`) shows an `Expired` badge instead of `Sent` /
 * `Viewed`. The DB row keeps its underlying status — this is purely a
 * display refinement so shops instantly see stale queue rows.
 */
export function isEffectivelyExpired(
  status: string,
  expiresAt: Date | string | null | undefined,
): boolean {
  if (!expiresAt) return false;
  if (status === "approved" || status === "declined" || status === "revoked") return false;
  const ms =
    typeof expiresAt === "string" ? new Date(expiresAt).getTime() : expiresAt.getTime();
  return ms < Date.now();
}

export function effectiveQuoteStatus(
  status: string,
  expiresAt: Date | string | null | undefined,
): string {
  return isEffectivelyExpired(status, expiresAt) ? "expired" : status;
}

export function QuoteStatusBadge({
  status,
  expiresAt,
}: {
  status: string;
  /** When provided, expired quotes render as "Expired" regardless of `status`. */
  expiresAt?: Date | string | null;
}) {
  const effective = effectiveQuoteStatus(status, expiresAt);
  return (
    <Badge className={`text-[10px] uppercase tracking-wide ${TONE[effective] ?? TONE.draft}`}>
      {effective}
    </Badge>
  );
}
