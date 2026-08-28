"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Archive, FileText, Plus, Trash2, X } from "lucide-react";

import { trpc } from "@/lib/trpc/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { QuoteStatusBadge, isEffectivelyExpired } from "./quote-status-badge";
import { PendingSchedulingList } from "@/modules/production/pending-scheduling-list";
import type { RouterOutputs } from "@/lib/trpc/types";

type QuoteRow = RouterOutputs["quotes"]["list"]["items"][number];

/**
 * Tab-driven status filter for the quote list. Each tab is a distinct URL
 * (`/quotes` or `/quotes?status=…`) so tab state survives bookmarks + the
 * back button. Predicates run over the fetched rows client-side — cheaper
 * than a server round-trip per tab and the list is capped at 100.
 */
const TABS: Array<{
  key: string;
  label: string;
  match: (q: QuoteRow) => boolean;
}> = [
  { key: "all", label: "All", match: () => true },
  { key: "draft", label: "Draft", match: (q) => q.status === "draft" },
  {
    key: "awaiting",
    label: "Awaiting approval",
    match: (q) =>
      (q.status === "sent" || q.status === "viewed") &&
      !isEffectivelyExpired(q.status, q.expiresAt),
  },
  { key: "approved", label: "Approved", match: (q) => q.status === "approved" },
  {
    key: "expired",
    label: "Expired",
    match: (q) => isEffectivelyExpired(q.status, q.expiresAt),
  },
  {
    key: "revoked",
    label: "Voided",
    match: (q) => q.status === "revoked" || q.status === "declined",
  },
];

export function QuoteList() {
  const search = useSearchParams();
  const rawStatus = search.get("status");
  const activeKey = TABS.some((t) => t.key === rawStatus) ? (rawStatus as string) : "all";
  const activeTab = TABS.find((t) => t.key === activeKey) ?? TABS[0];

  const query = trpc.quotes.list.useQuery({ limit: 100 });
  const rows = query.data?.items ?? [];

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of TABS) c[t.key] = rows.filter(t.match).length;
    return c;
  }, [rows]);

  const items = useMemo(() => rows.filter(activeTab.match), [rows, activeTab]);

  // ---- Bulk selection state ------------------------------------------------
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const archive = trpc.quotes.bulkArchive.useMutation();
  const del = trpc.quotes.bulkDelete.useMutation();
  const utils = trpc.useUtils();

  // Row-level: is this quote selectable? Approved quotes are locked out —
  // the server-side mutations reject them, so hide the checkbox rather than
  // letting the user think it worked.
  const isSelectable = (q: QuoteRow) => q.status !== "approved";

  const visibleSelectableIds = items.filter(isSelectable).map((q) => q.id);
  const allVisibleSelected =
    visibleSelectableIds.length > 0 &&
    visibleSelectableIds.every((id) => selected.has(id));

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    if (allVisibleSelected) {
      setSelected((s) => {
        const next = new Set(s);
        for (const id of visibleSelectableIds) next.delete(id);
        return next;
      });
    } else {
      setSelected((s) => {
        const next = new Set(s);
        for (const id of visibleSelectableIds) next.add(id);
        return next;
      });
    }
  }
  function clearSelection() {
    setSelected(new Set());
  }

  async function onArchive() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    try {
      const res = await archive.mutateAsync({ ids });
      await utils.quotes.list.invalidate();
      clearSelection();
      setConfirmArchive(false);
      const skipped = ids.length - res.archived;
      toast.success(
        `Archived ${res.archived} quote${res.archived === 1 ? "" : "s"}${
          skipped > 0 ? ` · ${skipped} skipped (approved)` : ""
        }.`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Archive failed");
      throw err;
    }
  }

  async function onDelete() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    try {
      const res = await del.mutateAsync({ ids });
      await utils.quotes.list.invalidate();
      clearSelection();
      setConfirmDelete(false);
      const skipped = ids.length - res.deleted;
      toast.success(
        `Deleted ${res.deleted} quote${res.deleted === 1 ? "" : "s"}${
          skipped > 0 ? ` · ${skipped} skipped (approved)` : ""
        }.`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
      throw err;
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Quotes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeKey === "all"
              ? "Every quote your shop has sent, most recent first."
              : `Filtered — ${items.length} of ${rows.length}.`}
          </p>
        </div>
        <Link href="/quotes/new" className={cn(buttonVariants())}>
          <Plus className="mr-2 h-4 w-4" />
          New quote
        </Link>
      </div>

      <div className="mb-6">
        <PendingSchedulingList />
      </div>

      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">
              {selected.size} quote{selected.size === 1 ? "" : "s"} selected
            </span>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={clearSelection}
              aria-label="Clear selection"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setConfirmArchive(true)}
              disabled={archive.isPending || del.isPending}
            >
              <Archive className="mr-1.5 h-3.5 w-3.5" />
              Archive
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => setConfirmDelete(true)}
              disabled={archive.isPending || del.isPending}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        </div>
      )}

      <div
        role="tablist"
        className="mb-4 flex flex-wrap items-center gap-1 border-b"
      >
        {TABS.map((t) => {
          const active = t.key === activeKey;
          return (
            <Link
              key={t.key}
              role="tab"
              aria-selected={active}
              href={t.key === "all" ? "/quotes" : `/quotes?status=${t.key}`}
              className={cn(
                "-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm transition-colors",
                active
                  ? "border-primary font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-[10px] tabular-nums",
                  active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                )}
              >
                {counts[t.key] ?? 0}
              </span>
            </Link>
          );
        })}
      </div>

      {query.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <FileText className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {activeKey === "all" ? "No quotes yet." : `No ${activeTab.label.toLowerCase()} quotes.`}
          </p>
          <div className="mt-4">
            <Link href="/quotes/new" className={cn(buttonVariants({ variant: "outline" }))}>
              <Plus className="mr-2 h-4 w-4" />
              Build a quote
            </Link>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          {visibleSelectableIds.length > 0 && (
            <div className="flex items-center gap-3 border-b bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleAll}
                aria-label="Select all"
                className="h-4 w-4 cursor-pointer"
              />
              <span>
                Select all in this view ({visibleSelectableIds.length})
              </span>
            </div>
          )}
          <ul className="divide-y">
            {items.map((q) => {
              const selectable = isSelectable(q);
              const isSelected = selected.has(q.id);
              return (
                <li
                  key={q.id}
                  className={cn(
                    "flex items-stretch gap-1 hover:bg-accent/40",
                    isSelected && "bg-primary/5",
                  )}
                >
                  {/* Checkbox lives outside the <Link> so clicking it
                      doesn't navigate. Approved quotes render a spacer
                      instead so the layout stays aligned. */}
                  <label
                    className={cn(
                      "flex shrink-0 items-center justify-center pl-4 pr-2",
                      selectable ? "cursor-pointer" : "cursor-default",
                    )}
                    onClick={(e) => {
                      if (!selectable) return;
                      e.stopPropagation();
                    }}
                  >
                    {selectable ? (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggle(q.id)}
                        aria-label={`Select quote Q-${q.number}`}
                        className="h-4 w-4 cursor-pointer"
                      />
                    ) : (
                      <span className="block h-4 w-4" aria-hidden />
                    )}
                  </label>

                  <Link
                    href={`/quotes/${q.id}`}
                    className="flex flex-1 items-center justify-between gap-4 py-3 pr-4"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm tabular-nums">
                            Q-{String(q.number).padStart(4, "0")}
                          </span>
                          <QuoteStatusBadge
                            status={q.status}
                            expiresAt={q.expiresAt}
                          />
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {q.customer.name}
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-mono text-sm tabular-nums">
                        {formatMoney(q.totalCents, q.currency)}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {new Date(q.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title={`Archive ${selected.size} quote${selected.size === 1 ? "" : "s"}?`}
        description="Archived quotes move to the Voided tab and stop appearing in the awaiting-approval count. Approved quotes are skipped — void or edit them individually."
        confirmLabel="Archive"
        variant="default"
        onConfirm={onArchive}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${selected.size} quote${selected.size === 1 ? "" : "s"}?`}
        description="Soft-deletes the selected quotes. They disappear from every list but stay in the database for audit. Approved quotes are skipped for safety."
        confirmLabel="Delete"
        onConfirm={onDelete}
      />
    </div>
  );
}
