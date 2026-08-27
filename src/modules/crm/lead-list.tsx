"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus, Search, UserPlus } from "lucide-react";

import { trpc } from "@/lib/trpc/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LEAD_STAGES, leadSourceLabel, leadStageLabel } from "@/lib/crm-catalog";
import { NewLeadDialog } from "./new-lead-dialog";

const STAGE_TONE: Record<string, string> = {
  new: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100",
  contacted: "bg-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200",
  waiting: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
  quote_sent: "bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-100",
  quote_viewed: "bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-100",
  follow_up: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
  approved: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100",
  scheduled: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100",
  converted: "bg-emerald-200 text-emerald-950 dark:bg-emerald-800/60 dark:text-emerald-50",
  lost: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100",
};

export function LeadList() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [openNew, setOpenNew] = useState(false);

  const query = trpc.leads.list.useQuery({
    q: q || undefined,
    status: status === "all" ? undefined : status,
    limit: 100,
  });

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Inbound interest from every source, in one pipeline.
          </p>
        </div>
        <Button onClick={() => setOpenNew(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New lead
        </Button>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
          <Input
            placeholder="Search by name, email, phone, vehicle…"
            className="pl-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v ?? "all")}>
          <SelectTrigger className="sm:w-48">
            <SelectValue placeholder="Any stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any stage</SelectItem>
            {LEAD_STAGES.map((s) => (
              <SelectItem key={s.key} value={s.key}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {query.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : query.data?.items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-12 text-center dark:border-neutral-700 dark:bg-neutral-950">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">No leads match.</p>
          <div className="mt-4">
            <Button onClick={() => setOpenNew(true)} variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Log a lead
            </Button>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-950">
          {query.data?.items.map((l) => (
            <li key={l.id}>
              <Link
                href={`/leads/${l.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-900"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-neutral-100 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                    <UserPlus className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{l.name}</div>
                    <div className="truncate text-xs text-neutral-500">
                      {leadSourceLabel(l.source)}
                      {l.vehicleDescription ? ` · ${l.vehicleDescription}` : ""}
                      {l.phone ? ` · ${l.phone}` : ""}
                    </div>
                  </div>
                </div>
                <Badge className={STAGE_TONE[l.status] ?? "bg-neutral-200 text-neutral-800"}>
                  {leadStageLabel(l.status)}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <NewLeadDialog
        open={openNew}
        onOpenChange={setOpenNew}
        onCreated={() => query.refetch()}
      />
    </div>
  );
}
