import { Suspense } from "react";

import { INTEGRATIONS } from "@/lib/integrations";
import { getAppSession } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { QuickBooksPanel } from "@/modules/billing/quickbooks-panel";

export default async function IntegrationsPage() {
  const session = await getAppSession();

  const live = await prisma.externalIntegration.findMany({
    where: { organizationId: session.organizationId },
  });
  const liveByKey = new Map(live.map((r) => [`${r.capability}:${r.provider}`, r]));

  const byCapability = INTEGRATIONS.reduce<Record<string, typeof INTEGRATIONS[number][]>>(
    (acc, i) => {
      (acc[i.capability] ??= []).push(i);
      return acc;
    },
    {},
  );

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Connect the third-party services your shop uses. Every integration is
          optional — the shop keeps working if any of them go down.
        </p>
      </div>

      <div className="mb-6">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-neutral-500">
          Accounting
        </h2>
        <Suspense fallback={null}>
          <QuickBooksPanel />
        </Suspense>
      </div>

      <div className="space-y-8">
        {Object.entries(byCapability).map(([capability, providers]) => (
          <section key={capability}>
            <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-neutral-500">
              {capability.replace(/_/g, " ")}
            </h2>
            <ul className="space-y-2">
              {providers.map((p) => {
                const status = liveByKey.get(`${p.capability}:${p.id}`);
                return (
                  <li
                    key={p.id}
                    className="flex items-start justify-between gap-4 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{p.name}</h3>
                        {"mvpDefault" in p && p.mvpDefault && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                        {p.description}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-neutral-500">
                        <span>{p.vendor}</span>
                        <span>·</span>
                        <span>{p.costType.replace(/_/g, " ")}</span>
                        <span>·</span>
                        <span>{p.authType.replace(/_/g, " ")}</span>
                      </div>
                    </div>
                    <div className="text-right text-xs">
                      {status ? (
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium uppercase tracking-wide ${
                            status.status === "healthy"
                              ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100"
                              : status.status === "unauthorized"
                                ? "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100"
                                : "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100"
                          }`}
                        >
                          {status.status}
                        </span>
                      ) : (
                        <span className="text-neutral-500">Not connected</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
