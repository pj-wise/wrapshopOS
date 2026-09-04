import Link from "next/link";
import { ArrowRight, ExternalLink, Zap } from "lucide-react";

import { getAppSession } from "@/server/auth/session";
import { PLANS, formatPriceCents, PLAN_ORDER, type PlanId } from "@/lib/plans";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Billing · autoLuxOS",
};

/**
 * Customer-facing billing surface. Shows the org's current plan + basic
 * entitlements. Plan changes route to /pricing for now; self-serve
 * subscription management (Stripe Checkout for autoLuxOS's own SaaS)
 * ships in a follow-up.
 */
export default async function BillingPage() {
  const session = await getAppSession();
  const currentPlanId = session.organizationTier as PlanId;
  const plan = PLANS[currentPlanId];
  const isPaid =
    plan.monthlyPriceCents != null && plan.monthlyPriceCents > 0;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your current plan and included entitlements.
        </p>
      </div>

      {/* Current plan */}
      <div
        className={cn(
          "mb-6 overflow-hidden rounded-lg border",
          plan.recommended
            ? "border-neutral-900 bg-neutral-900 text-neutral-50 dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
            : "border-neutral-200 bg-card",
        )}
      >
        <div className="flex items-start justify-between gap-4 p-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest opacity-70">
              <Zap className="h-3 w-3" />
              Current plan
            </div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">
              {plan.displayName}
            </h2>
            <p className={cn("mt-1 text-sm", plan.recommended ? "opacity-90" : "text-muted-foreground")}>
              {plan.tagline}
            </p>
          </div>
          <div className="text-right">
            {plan.monthlyPriceCents != null ? (
              <>
                <div className="text-2xl font-semibold tabular-nums">
                  {formatPriceCents(plan.monthlyPriceCents)}
                </div>
                <div className={cn("text-xs", plan.recommended ? "opacity-80" : "text-muted-foreground")}>
                  per month
                </div>
              </>
            ) : (
              <div className="text-sm font-medium">Volume pricing</div>
            )}
          </div>
        </div>
      </div>

      {/* Entitlements */}
      <div className="mb-6 rounded-lg border bg-card p-6">
        <h3 className="mb-4 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          What&apos;s included
        </h3>
        <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <Entitlement
            label="Users"
            value={plan.entitlements.maxUsers == null ? "Unlimited" : String(plan.entitlements.maxUsers)}
          />
          <Entitlement
            label="Locations"
            value={
              plan.entitlements.maxLocations === Number.POSITIVE_INFINITY
                ? "Multi (per-location pricing)"
                : String(plan.entitlements.maxLocations)
            }
          />
          <Entitlement
            label="Media storage"
            value={
              plan.entitlements.storageBytes === 0
                ? "—"
                : formatBytes(plan.entitlements.storageBytes)
            }
          />
          <Entitlement
            label="SMS / month"
            value={
              plan.entitlements.smsMessagesPerMonth == null
                ? "Metered"
                : plan.entitlements.smsMessagesPerMonth === 0
                  ? "—"
                  : plan.entitlements.smsMessagesPerMonth.toLocaleString()
            }
          />
          <Entitlement
            label="AI requests / month"
            value={
              plan.entitlements.aiRequestsPerMonth == null
                ? "Metered"
                : plan.entitlements.aiRequestsPerMonth === 0
                  ? "—"
                  : plan.entitlements.aiRequestsPerMonth.toLocaleString()
            }
          />
        </dl>
      </div>

      {/* Change plan */}
      <div className="mb-6 rounded-lg border bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-medium">Change your plan</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Compare Free, Solo, Shop, Pro, and multi-location Enterprise
              on the public pricing page. Self-serve upgrades via Stripe
              Checkout are coming soon — until then, we&apos;ll switch you
              over manually.
            </p>
          </div>
          <Link
            href="/pricing"
            target="_blank"
            className="inline-flex shrink-0 items-center gap-2 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-50 hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            See pricing
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Other plans preview */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="mb-4 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Other plans
        </h3>
        <ul className="divide-y">
          {PLAN_ORDER.filter((id) => id !== currentPlanId).map((id) => {
            const other = PLANS[id];
            return (
              <li key={id} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <div className="text-sm font-medium">{other.displayName}</div>
                  <div className="text-xs text-muted-foreground">{other.tagline}</div>
                </div>
                <div className="text-right text-sm tabular-nums">
                  {other.monthlyPriceCents != null
                    ? `${formatPriceCents(other.monthlyPriceCents)}/mo`
                    : "Per location"}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 text-right">
          <Link
            href="/pricing"
            target="_blank"
            className="inline-flex items-center gap-1 text-sm text-neutral-900 hover:underline dark:text-neutral-100"
          >
            Compare all plans
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {!isPaid && (
        <p className="mt-6 text-center text-xs text-muted-foreground">
          You&apos;re on Free — no card on file. Upgrade to unlock digital
          workflows, Stripe payments, and team features.
        </p>
      )}
    </div>
  );
}

function Entitlement({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-widest text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function formatBytes(bytes: number): string {
  const GB = 1024 ** 3;
  if (bytes >= GB) return `${Math.round(bytes / GB)} GB`;
  const MB = 1024 ** 2;
  if (bytes >= MB) return `${Math.round(bytes / MB)} MB`;
  return `${bytes} B`;
}
