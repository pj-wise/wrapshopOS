"use client";

import { useState } from "react";
import { Loader2, Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import type { IntegrationDef } from "@/lib/integrations";

import { IntegrationConfigDialog } from "./integration-config-dialog";

/**
 * The interactive island rendered next to each provider card on the admin
 * integrations page. Two responsibilities:
 *   1. Fetch the current org's list of overrides (one query, shared across
 *      every card — TanStack Query dedupes it in the cache).
 *   2. Render either "Configure" (opens the generic dialog) or "Connected —
 *      Manage" pill when overrides are present. Providers without
 *      `configFields` (e.g. QuickBooks OAuth, Supabase Storage) skip this
 *      component entirely.
 */
export function IntegrationConnectButton({ def }: { def: IntegrationDef }) {
  const overrides = trpc.integrations.listOverrides.useQuery(undefined, {
    staleTime: 30_000,
  });
  const [dialogOpen, setDialogOpen] = useState(false);

  if (!def.configFields || def.configFields.length === 0) return null;

  const row = overrides.data?.find(
    (o) => o.capability === def.capability && o.provider === def.id,
  );
  const populatedFields = row?.populatedFields ?? [];
  const hasOverride = populatedFields.length > 0;

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant={hasOverride ? "outline" : "default"}
        onClick={() => setDialogOpen(true)}
        disabled={overrides.isLoading}
      >
        {overrides.isLoading ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Settings2 className="mr-1.5 h-3.5 w-3.5" />
        )}
        {hasOverride ? "Manage" : "Configure"}
      </Button>

      <IntegrationConfigDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        def={def}
        populatedFields={populatedFields}
      />
    </>
  );
}
