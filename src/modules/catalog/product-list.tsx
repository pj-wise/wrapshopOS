"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Package, Pencil, Plus, Search, Sparkles, Trash2 } from "lucide-react";

import { trpc } from "@/lib/trpc/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatMoney } from "@/lib/money";
import { NewServiceDialog } from "./new-service-dialog";
import { EditServiceDialog } from "./edit-service-dialog";
import type { RouterOutputs } from "@/lib/trpc/types";

type Product = RouterOutputs["services"]["list"][number];

const PRICING_TONE: Record<string, string> = {
  flat: "bg-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100",
  coverage: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100",
  hourly: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
  matrix: "bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-100",
  variable: "bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-100",
};

/**
 * Full CRUD surface over the product/service catalog.
 *
 * Under the hood these are `Service` records — one catalog powers both the
 * "products" the shop sells and the labor-priced services attached to jobs.
 * The Products page just exposes it as a top-level concept instead of
 * burying it under Admin → Settings.
 */
export function ProductList() {
  const [q, setQ] = useState("");
  const [openNew, setOpenNew] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);

  const query = trpc.services.list.useQuery({ q: q || undefined, activeOnly: false });
  const softDelete = trpc.services.softDelete.useMutation();
  const utils = trpc.useUtils();

  const rows = useMemo(() => query.data ?? [], [query.data]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Products &amp; services</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything your shop can sell — wraps, PPF, tint, coatings, add-ons.
            Anything active here appears in the line-item picker on quotes.
          </p>
        </div>
        <Button onClick={() => setOpenNew(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New product
        </Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, SKU, description…"
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
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Sparkles className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No products yet. Add your first — or run <code>pnpm db:seed</code> to load the
            starter Apex Restyling catalog.
          </p>
          <div className="mt-4">
            <Button onClick={() => setOpenNew(true)} variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Add a product
            </Button>
          </div>
        </div>
      ) : (
        <ul className="divide-y overflow-hidden rounded-lg border bg-card">
          {rows.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-accent/40"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                  <Package className="h-4 w-4" />
                </div>
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
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <div className="text-right font-mono text-sm tabular-nums">
                  {s.pricingModel === "coverage"
                    ? `${formatMoney(s.priceCents)}/sqft`
                    : s.pricingModel === "hourly"
                      ? `${formatMoney(s.hourlyRateCents ?? 0)}/hr`
                      : formatMoney(s.priceCents)}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setEditing(s)}
                    title="Edit"
                    aria-label={`Edit ${s.name}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setDeleting(s)}
                    title="Delete"
                    aria-label={`Delete ${s.name}`}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
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

      {editing && (
        <EditServiceDialog
          open={!!editing}
          onOpenChange={(v) => !v && setEditing(null)}
          service={editing}
          onSaved={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        title="Delete product?"
        description={
          deleting
            ? `Soft-deletes "${deleting.name}". Historical line items on existing quotes and jobs keep the reference; it just disappears from the picker on new quotes.`
            : undefined
        }
        confirmLabel="Delete product"
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await softDelete.mutateAsync({ id: deleting.id });
            await utils.services.list.invalidate();
            toast.success("Product deleted.");
            setDeleting(null);
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Delete failed");
            throw err;
          }
        }}
      />
    </div>
  );
}
