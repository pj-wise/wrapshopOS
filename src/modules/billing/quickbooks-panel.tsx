"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";

import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * QuickBooks connect / status panel for /admin/integrations. Reads the
 * `?qbo=success|error&detail=…` query params the OAuth callback sets so we
 * can flash feedback right after redirect.
 */
export function QuickBooksPanel() {
  const search = useSearchParams();
  const router = useRouter();
  const flash = search.get("qbo");
  const detail = search.get("detail");
  const status = trpc.accounting.status.useQuery();
  const disconnect = trpc.accounting.disconnect.useMutation();
  const utils = trpc.useUtils();

  useEffect(() => {
    if (flash === "success") {
      toast.success("QuickBooks connected.");
      router.replace("/admin/integrations");
      utils.accounting.status.invalidate();
    } else if (flash === "error") {
      toast.error(`QuickBooks connect failed: ${detail ?? "unknown"}`);
      router.replace("/admin/integrations");
    }
  }, [flash, detail, router, utils]);

  async function onDisconnect() {
    if (!confirm("Disconnect QuickBooks? Invoices will stop syncing.")) return;
    try {
      await disconnect.mutateAsync();
      toast.success("QuickBooks disconnected.");
      await utils.accounting.status.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  if (status.isLoading) return <Skeleton className="h-24" />;
  const s = status.data;
  if (!s) return null;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-medium">QuickBooks Online</h3>
            {s.connected ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100">
                <CheckCircle2 className="h-3 w-3" /> connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] uppercase tracking-wide text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
                <XCircle className="h-3 w-3" /> not connected
              </span>
            )}
          </div>
          {s.connected ? (
            <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
              {s.companyName && <div>Company: {s.companyName}</div>}
              <div>Realm: {s.realmId}</div>
              <div>Env: {s.environment}</div>
              {s.lastRefreshedAt && (
                <div>
                  Refreshed {new Date(s.lastRefreshedAt).toLocaleString()}
                  {s.accessExpiresAt && (
                    <> · expires {new Date(s.accessExpiresAt).toLocaleTimeString()}</>
                  )}
                </div>
              )}
              {s.lastRefreshError && (
                <div className="text-red-600">
                  Last refresh error: {s.lastRefreshError}
                </div>
              )}
            </div>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              Connect QuickBooks Online so invoices sync automatically and
              customers can pay you via QuickBooks-hosted payment pages.
            </p>
          )}
          {!s.envConfigured && (
            <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
              <strong>QBO env not configured.</strong> Set{" "}
              <code>QBO_CLIENT_ID</code>, <code>QBO_CLIENT_SECRET</code>, and{" "}
              <code>QBO_WEBHOOK_VERIFIER</code> in your <code>.env.local</code>.
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {s.connected ? (
            <Button size="sm" variant="outline" onClick={onDisconnect} disabled={disconnect.isPending}>
              Disconnect
            </Button>
          ) : (
            <a
              href="/api/oauth/quickbooks/start"
              className={s.envConfigured ? "inline-block" : "pointer-events-none opacity-50"}
              aria-disabled={!s.envConfigured}
            >
              <Button size="sm" disabled={!s.envConfigured}>
                Connect
              </Button>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
