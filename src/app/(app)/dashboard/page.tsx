import Link from "next/link";
import { ArrowRight, Car, FileText, Inbox, Wrench } from "lucide-react";

import { getAppSession } from "@/server/auth/session";
import { dbFor } from "@/server/db-scoped";
import { formatMoney } from "@/lib/money";
import { JobCalendar } from "@/modules/production/job-calendar";
import { PendingSchedulingList } from "@/modules/production/pending-scheduling-list";

/**
 * Dashboard — Server Component. Reads current shop vitals directly through
 * the tenant-scoped Prisma client (no tRPC round-trip). Fast because it's
 * three cheap counts + a couple of aggregations, all executed in parallel.
 */
export default async function DashboardPage() {
  const session = await getAppSession();
  const db = dbFor(session.organizationId);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    vehiclesInShopCount,
    openQuotesCount,
    outstandingInvoices,
    revenueThisMonth,
    recentActivity,
    unreadThreads,
  ] = await Promise.all([
    db.job.count({
      where: {
        deletedAt: null,
        status: { in: ["checked_in", "prep", "in_progress", "qc", "ready_for_pickup"] },
      },
    }),
    db.quote.count({
      where: { deletedAt: null, status: { in: ["sent", "viewed"] } },
    }),
    db.invoice.aggregate({
      _sum: { balanceCents: true },
      _count: { _all: true },
      where: {
        deletedAt: null,
        status: { in: ["sent", "viewed", "partial", "past_due"] },
      },
    }),
    db.quote.aggregate({
      _sum: { totalCents: true },
      where: {
        deletedAt: null,
        status: "approved",
        approvedAt: { gte: startOfMonth },
      },
    }),
    db.timelineEvent.findMany({
      take: 8,
      orderBy: { occurredAt: "desc" },
      include: { actor: { select: { name: true, email: true } } },
    }),
    db.messageThread.count({
      where: { status: "open", unreadCount: { gt: 0 } },
    }),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Welcome back{session.name ? `, ${session.name}` : ""}. Here&apos;s what&apos;s happening at{" "}
          <strong>{session.organizationName}</strong>.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatLink
          href="/jobs"
          label="Vehicles in shop"
          value={vehiclesInShopCount.toString()}
          hint={vehiclesInShopCount === 0 ? "No jobs checked in" : "In production"}
          icon={Car}
        />
        <StatLink
          href="/quotes"
          label="Quotes awaiting approval"
          value={openQuotesCount.toString()}
          hint={openQuotesCount === 0 ? "Nothing pending" : "Sent or viewed"}
          icon={FileText}
        />
        <StatLink
          href="/invoices"
          label="Outstanding"
          value={formatMoney(outstandingInvoices._sum.balanceCents ?? 0)}
          hint={`${outstandingInvoices._count._all} open invoice${outstandingInvoices._count._all === 1 ? "" : "s"}`}
          icon={Wrench}
        />
        <StatLink
          href="/reports"
          label="Revenue this month"
          value={formatMoney(revenueThisMonth._sum.totalCents ?? 0)}
          hint="From approved quotes"
          icon={ArrowRight}
        />
      </div>

      <div className="mt-6">
        <PendingSchedulingList maxItems={5} />
      </div>

      <div className="mt-6">
        <JobCalendar />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Recent activity
            </h2>
            <Link href="/admin/audit" className="text-xs text-muted-foreground hover:underline">
              Audit log →
            </Link>
          </div>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No activity yet. Approve a quote or check in a vehicle to get things moving.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {recentActivity.map((e) => (
                <li key={e.id} className="flex items-start gap-3">
                  <span className="w-16 shrink-0 text-xs text-muted-foreground">
                    {new Date(e.occurredAt).toLocaleTimeString(undefined, {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="min-w-0">
                    <span className="font-medium">
                      {formatKind(e.kind)}
                    </span>
                    {e.actor && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        by {e.actor.name ?? e.actor.email}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Inbox
            </h2>
            <Link href="/inbox" className="text-xs text-muted-foreground hover:underline">
              Open inbox →
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-muted text-muted-foreground">
              <Inbox className="h-4 w-4" />
            </div>
            <div>
              <div className="text-2xl font-semibold tabular-nums">{unreadThreads}</div>
              <div className="text-xs text-muted-foreground">
                unread conversation{unreadThreads === 1 ? "" : "s"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatLink({
  href,
  label,
  value,
  hint,
  icon: Icon,
}: {
  href: string;
  label: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg border bg-card p-4 transition hover:border-primary/40"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <p className="mt-2 font-mono text-2xl tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </Link>
  );
}

function formatKind(kind: string): string {
  return kind.replace(/_/g, " ").replace(/\./g, " · ");
}
