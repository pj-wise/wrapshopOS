"use client";

import { useState } from "react";
import { Loader2, Zap } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Tier = "free" | "solo" | "shop" | "pro" | "enterprise";

/**
 * Platform operator view — one row per org across every tenant. The
 * inline tier selector is the primary knob; other operator actions
 * (impersonate, suspend, migrate) belong here later.
 */
export function PlatformOrgsPanel() {
  const q = trpc.platform.listOrgs.useQuery();

  if (q.isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }
  if (q.error) {
    return (
      <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100">
        {q.error.message}
      </div>
    );
  }

  const rows = q.data ?? [];
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        No organizations found.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <ul className="divide-y">
        {rows.map((org) => (
          <OrgRow key={org.id} org={org} />
        ))}
      </ul>
    </div>
  );
}

function OrgRow({
  org,
}: {
  org: {
    id: string;
    name: string;
    slug: string;
    tier: string;
    subscriptionStatus: string;
    createdAt: Date;
    _count: { members: number; jobs: number; quotes: number };
  };
}) {
  const update = trpc.platform.updateOrgTier.useMutation();
  const [selected, setSelected] = useState<Tier>(
    (org.tier as Tier) ?? "free",
  );
  const dirty = selected !== org.tier;

  async function onSave() {
    try {
      await update.mutateAsync({ orgId: org.id, tier: selected });
      // Hard-reload after every save. The operator's own FeatureProvider
      // was hydrated at layout render — client-side nav wouldn't pick up
      // a new tier without this. Reloading also keeps other tabs the
      // operator has open on a stale snapshot (they can refresh
      // themselves), so this is only about the tab that just clicked.
      toast.success(`${org.name} → ${labelFor(selected)}. Reloading…`);
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  }

  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm font-medium">{org.name}</div>
          <TierPill tier={org.tier as Tier} />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {org.subscriptionStatus}
          </span>
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          <span className="font-mono">{org.slug}</span> · {org._count.members} member
          {org._count.members === 1 ? "" : "s"} · {org._count.jobs} job
          {org._count.jobs === 1 ? "" : "s"} · {org._count.quotes} quote
          {org._count.quotes === 1 ? "" : "s"} · created{" "}
          {new Date(org.createdAt).toLocaleDateString()}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Select
          value={selected}
          onValueChange={(v) => v && setSelected(v as Tier)}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="solo">Solo</SelectItem>
            <SelectItem value="shop">Shop</SelectItem>
            <SelectItem value="pro">Pro</SelectItem>
            <SelectItem value="enterprise">Enterprise</SelectItem>
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="sm"
          onClick={onSave}
          disabled={!dirty || update.isPending}
        >
          {update.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Save
        </Button>
      </div>
    </li>
  );
}

const TIER_TONES: Record<Tier, string> = {
  free: "bg-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100",
  solo: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100",
  shop: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100",
  pro: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
  enterprise:
    "bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-100",
};

function TierPill({ tier }: { tier: Tier }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        TIER_TONES[tier] ?? TIER_TONES.free,
      )}
    >
      <Zap className="h-3 w-3" />
      {labelFor(tier)}
    </span>
  );
}

function labelFor(tier: string): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}
