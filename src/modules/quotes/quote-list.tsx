"use client";

import Link from "next/link";
import { FileText, Plus } from "lucide-react";

import { trpc } from "@/lib/trpc/client";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { QuoteStatusBadge } from "./quote-status-badge";
import { PendingSchedulingList } from "@/modules/production/pending-scheduling-list";

export function QuoteList() {
  const query = trpc.quotes.list.useQuery({ limit: 50 });

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Quotes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every quote your shop has sent, most recent first.
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

      {query.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : query.data?.items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <FileText className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No quotes yet.</p>
          <div className="mt-4">
            <Link href="/quotes/new" className={cn(buttonVariants({ variant: "outline" }))}>
              <Plus className="mr-2 h-4 w-4" />
              Build a quote
            </Link>
          </div>
        </div>
      ) : (
        <ul className="divide-y overflow-hidden rounded-lg border bg-card">
          {query.data?.items.map((q) => (
            <li key={q.id}>
              <Link
                href={`/quotes/${q.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-accent/40"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm tabular-nums">Q-{String(q.number).padStart(4, "0")}</span>
                      <QuoteStatusBadge status={q.status} />
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
          ))}
        </ul>
      )}
    </div>
  );
}
