"use client";

import Link from "next/link";
import { Receipt } from "lucide-react";

import { trpc } from "@/lib/trpc/client";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/money";
import { InvoiceStatusBadge, QboSyncBadge } from "./invoice-status-badge";

export function InvoiceList() {
  const q = trpc.invoices.list.useQuery({ limit: 100 });

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Invoices are created automatically when jobs are delivered; QuickBooks sync
          runs in the background.
        </p>
      </div>

      {q.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : q.data?.items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Receipt className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No invoices yet.</p>
        </div>
      ) : (
        <ul className="divide-y overflow-hidden rounded-lg border bg-card">
          {q.data?.items.map((inv) => (
            <li key={inv.id}>
              <Link
                href={`/invoices/${inv.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-accent/40"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                    <Receipt className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm tabular-nums">
                        INV-{String(inv.number).padStart(4, "0")}
                      </span>
                      <InvoiceStatusBadge status={inv.status} />
                      <QboSyncBadge status={inv.qboSyncStatus} />
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {inv.customer.name}
                    </div>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-mono text-sm tabular-nums">
                    {formatMoney(inv.totalCents, inv.currency)}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    balance {formatMoney(inv.balanceCents, inv.currency)}
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
