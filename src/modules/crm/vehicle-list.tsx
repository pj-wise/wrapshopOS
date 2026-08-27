"use client";

import Link from "next/link";
import { useState } from "react";
import { Car, Plus, Search } from "lucide-react";

import { trpc } from "@/lib/trpc/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AddVehicleDialog } from "./add-vehicle-dialog";

export function VehicleList() {
  const [q, setQ] = useState("");
  const [openNew, setOpenNew] = useState(false);
  const query = trpc.vehicles.list.useQuery({ q: q || undefined, limit: 50 });

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vehicles</h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Every vehicle your shop has touched.
          </p>
        </div>
        <Button onClick={() => setOpenNew(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add vehicle
        </Button>
      </div>

      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
        <Input
          placeholder="Search by VIN, plate, make, model…"
          className="pl-9 uppercase placeholder:normal-case"
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
      ) : query.data?.items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-12 text-center dark:border-neutral-700 dark:bg-neutral-950">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            No vehicles yet.
          </p>
          <div className="mt-4">
            <Button onClick={() => setOpenNew(true)} variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Add your first vehicle
            </Button>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-950">
          {query.data?.items.map((v) => (
            <li key={v.id}>
              <Link
                href={`/vehicles/${v.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-900"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-neutral-100 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                    <Car className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {[v.year, v.make, v.model, v.trim].filter(Boolean).join(" ") || "(unnamed)"}
                    </div>
                    <div className="truncate text-xs text-neutral-500">
                      {v.vin ? `VIN ${v.vin}` : "no VIN"}
                      {v.plate ? ` · ${v.plate}` : ""}
                      {v.customer ? ` · ${v.customer.name}` : ""}
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <AddVehicleDialog
        open={openNew}
        onOpenChange={setOpenNew}
        onCreated={() => query.refetch()}
      />
    </div>
  );
}
