"use client";

import { trpc } from "@/lib/trpc/client";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/money";

/**
 * Basic reports dashboard. Four stat cards + four bar-style tables. No chart
 * library — bare bars render in-place as CSS. Charts land as a `pro`-tier
 * enrichment (`reporting.advanced`).
 */
export function ReportsView() {
  const summary = trpc.reports.summary.useQuery();
  const revenueByMonth = trpc.reports.revenueByMonth.useQuery({ months: 12 });
  const serviceMix = trpc.reports.serviceMix.useQuery({ days: 90 });
  const techHours = trpc.reports.techHours.useQuery({ days: 30 });
  const materialProfit = trpc.reports.materialProfitability.useQuery({ days: 90 });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Operational + financial vitals. Numbers reflect approved quotes + delivered jobs.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Revenue this month"
          value={
            summary.data
              ? formatMoney(summary.data.revenueThisMonthCents)
              : undefined
          }
          hint={
            summary.data
              ? `Last month ${formatMoney(summary.data.revenueLastMonthCents)}`
              : undefined
          }
          loading={summary.isLoading}
        />
        <StatCard
          label="Jobs in progress"
          value={summary.data?.jobsInProgress.toString()}
          loading={summary.isLoading}
        />
        <StatCard
          label="Open quotes"
          value={summary.data?.openQuotes.toString()}
          loading={summary.isLoading}
        />
        <StatCard
          label="Quote-to-close (90d)"
          value={
            summary.data
              ? `${(summary.data.quoteToCloseRate * 100).toFixed(0)}%`
              : undefined
          }
          hint={
            summary.data
              ? `Avg ticket ${formatMoney(summary.data.avgTicketCents)}`
              : undefined
          }
          loading={summary.isLoading}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Revenue by month */}
        <ReportCard title="Revenue by month (last 12)" loading={revenueByMonth.isLoading}>
          {revenueByMonth.data && revenueByMonth.data.length > 0 ? (
            <BarChart
              rows={revenueByMonth.data.map((r) => ({
                label: r.month,
                value: r.totalCents,
                display: formatMoney(r.totalCents),
              }))}
            />
          ) : (
            <EmptyText>No approved quotes yet.</EmptyText>
          )}
        </ReportCard>

        {/* Service mix */}
        <ReportCard title="Service mix (last 90 days)" loading={serviceMix.isLoading}>
          {serviceMix.data && serviceMix.data.length > 0 ? (
            <BarChart
              rows={serviceMix.data.map((r) => ({
                label: r.description,
                value: r.totalCents,
                display: `${formatMoney(r.totalCents)} · ${r.count}×`,
              }))}
            />
          ) : (
            <EmptyText>No approved quote line items in that range.</EmptyText>
          )}
        </ReportCard>

        {/* Tech hours */}
        <ReportCard title="Tech hours (last 30 days)" loading={techHours.isLoading}>
          {techHours.data && techHours.data.length > 0 ? (
            <BarChart
              rows={techHours.data.map((r) => ({
                label: r.name,
                value: r.hours,
                display: `${r.hours.toFixed(1)} h`,
              }))}
            />
          ) : (
            <EmptyText>No time entries in that range.</EmptyText>
          )}
        </ReportCard>

        {/* Material profitability */}
        <ReportCard title="Material spend (last 90 days)" loading={materialProfit.isLoading}>
          {materialProfit.data && materialProfit.data.length > 0 ? (
            <BarChart
              rows={materialProfit.data.map((r) => ({
                label: r.material,
                value: r.costCents,
                display: `${formatMoney(r.costCents)} · ${r.ydUsed.toFixed(1)} yd`,
              }))}
            />
          ) : (
            <EmptyText>No roll deductions in that range.</EmptyText>
          )}
        </ReportCard>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  loading,
}: {
  label: string;
  value: string | undefined;
  hint?: string;
  loading: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-24" />
      ) : (
        <>
          <div className="mt-2 font-mono text-2xl tabular-nums">{value ?? "—"}</div>
          {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
        </>
      )}
    </div>
  );
}

function ReportCard({
  title,
  loading,
  children,
}: {
  title: string;
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {title}
      </h2>
      {loading ? <Skeleton className="h-32" /> : children}
    </div>
  );
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function BarChart({
  rows,
}: {
  rows: Array<{ label: string; value: number; display: string }>;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-1.5">
      {rows.map((r, i) => {
        const pct = Math.max(1, Math.round((r.value / max) * 100));
        return (
          <li key={`${r.label}-${i}`} className="text-xs">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate">{r.label}</span>
              <span className="font-mono tabular-nums text-muted-foreground">
                {r.display}
              </span>
            </div>
            <div className="mt-0.5 h-1.5 rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary/70"
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
