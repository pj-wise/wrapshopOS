"use client";

import { useState } from "react";
import { Plus, Search, Sparkles } from "lucide-react";

import { trpc } from "@/lib/trpc/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/money";
import { NewServiceDialog } from "./new-service-dialog";

const PRICING_TONE: Record<string, string> = {
  flat: "bg-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100",
  coverage: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100",
  hourly: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
  matrix: "bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-100",
};

export function ServiceList() {
  const [q, setQ] = useState("");
  const [openNew, setOpenNew] = useState(false);
  const query = trpc.services.list.useQuery({ q: q || undefined, activeOnly: false });

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Services</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your shop&apos;s catalog. Add services you sell so they can drop into quotes with pricing.
          </p>
        </div>
        <Button onClick={() => setOpenNew(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New service
        </Button>
      </div>

      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search services…"
          className="pl-9"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {query.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : query.data?.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Sparkles className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No services yet. Add your first (or run the demo seed).
          </p>
          <div className="mt-4">
            <Button onClick={() => setOpenNew(true)} variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Add a service
            </Button>
          </div>
        </div>
      ) : (
        <ul className="divide-y overflow-hidden rounded-lg border bg-card">
          {query.data?.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-accent/40"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{s.name}</span>
                  {!s.active && (
                    <Badge variant="outline" className="text-[10px]">
                      inactive
                    </Badge>
                  )}
                  <Badge
                    className={`text-[10px] uppercase tracking-wide ${PRICING_TONE[s.pricingModel]}`}
                  >
                    {s.pricingModel}
                  </Badge>
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {s.category?.name ?? "Uncategorized"}
                  {s.description ? ` · ${s.description}` : ""}
                </div>
              </div>
              <div className="shrink-0 text-right font-mono text-sm tabular-nums">
                {s.pricingModel === "coverage"
                  ? `${formatMoney(s.priceCents)}/sqft`
                  : s.pricingModel === "hourly"
                    ? `${formatMoney(s.hourlyRateCents ?? 0)}/hr`
                    : formatMoney(s.priceCents)}
              </div>
            </li>
          ))}
        </ul>
      )}

      <NewServiceDialog
        open={openNew}
        onOpenChange={setOpenNew}
        onCreated={() => query.refetch()}
      />
    </div>
  );
}
