"use client";

import { useState } from "react";
import { Package, Plus, Search } from "lucide-react";

import { trpc } from "@/lib/trpc/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/money";

export function MaterialList() {
  const [q, setQ] = useState("");
  const query = trpc.materials.list.useQuery({ q: q || undefined });

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Films, PPFs, tints, ceramics — and the rolls you keep on the shelf.
          </p>
        </div>
        <Button disabled>
          <Plus className="mr-2 h-4 w-4" />
          New material
        </Button>
      </div>

      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search material, manufacturer, series, color…"
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
          <Package className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No materials yet. The demo seed adds the common 3M / Avery / XPEL / LLumar stock.
          </p>
        </div>
      ) : (
        <ul className="divide-y overflow-hidden rounded-lg border bg-card">
          {query.data?.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-accent/40"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{m.name}</span>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {m.category.replace(/_/g, " ")}
                  </Badge>
                  {!m.active && (
                    <Badge variant="outline" className="text-[10px]">
                      inactive
                    </Badge>
                  )}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {[m.manufacturer, m.series, m.color, m.finish]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </div>
              </div>
              <div className="shrink-0 text-right text-xs text-muted-foreground">
                <div>
                  {m._count.rolls} roll{m._count.rolls === 1 ? "" : "s"} on-hand
                </div>
                {m.costPerFootCents ? (
                  <div className="font-mono tabular-nums">
                    {formatMoney(m.costPerFootCents)}/ft
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
