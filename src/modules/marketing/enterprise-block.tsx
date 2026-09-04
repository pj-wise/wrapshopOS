import { Building2, PhoneCall } from "lucide-react";

import {
  ENTERPRISE_PRICING_BANDS,
  formatPriceCents,
} from "@/lib/plans";

/**
 * Multi-location Enterprise block. Deliberately separate from the 4-across
 * pricing cards so shops don't misread it as a 5th flat-price plan.
 *
 * Volume pricing table reads from ENTERPRISE_PRICING_BANDS in src/lib/plans.ts.
 */
export function EnterpriseBlock({
  contactHref = "mailto:sales@autoluxos.com",
}: {
  contactHref?: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-8 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="mb-6 flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-100">
          <Building2 className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-2xl font-semibold tracking-tight">Enterprise</h3>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Multi-location pricing for shops with 2+ physical locations. Volume
            discounts increase as your count grows.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {ENTERPRISE_PRICING_BANDS.map((band) => {
          const range =
            band.maxLocations == null
              ? `${band.minLocations}+ shops`
              : `${band.minLocations}–${band.maxLocations} shops`;
          return (
            <div
              key={`${band.minLocations}-${band.maxLocations ?? "inf"}`}
              className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div className="text-xs font-medium uppercase tracking-widest text-neutral-500">
                {range}
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-semibold">
                  {formatPriceCents(band.perLocationCents)}
                </span>
                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                  / shop / month
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <a
          href={contactHref}
          className="inline-flex items-center gap-2 rounded-md bg-neutral-900 px-5 py-2.5 text-sm font-medium text-neutral-50 hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          <PhoneCall className="h-4 w-4" />
          Talk to sales
        </a>
        <p className="text-xs text-neutral-500">
          Includes everything in Pro + cross-shop dashboard, centralized
          admin, PPF pattern integration, SSO, audit logs, API access, and
          dedicated support.
        </p>
      </div>
    </div>
  );
}
