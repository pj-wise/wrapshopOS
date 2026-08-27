"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Car, FileText, Pencil, Plus, Trash2 } from "lucide-react";

import { trpc } from "@/lib/trpc/client";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { AddVehicleDialog } from "./add-vehicle-dialog";
import { EditCustomerDialog } from "./edit-customer-dialog";
import { QuoteStatusBadge } from "@/modules/quotes/quote-status-badge";

export function CustomerDetail({ id }: { id: string }) {
  const router = useRouter();
  const [addVehicleOpen, setAddVehicleOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const q = trpc.customers.get.useQuery({ id });
  const softDelete = trpc.customers.softDelete.useMutation();
  const utils = trpc.useUtils();
  const timelineQuery = trpc.customers.timeline.useQuery({ id });
  const quotesQuery = trpc.quotes.list.useQuery({ customerId: id, limit: 100 });
  const jobsQuery = trpc.jobs.list.useQuery({ customerId: id });

  if (q.isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  if (q.error) {
    return (
      <div className="mx-auto max-w-6xl">
        <p className="text-sm text-red-600">{q.error.message}</p>
      </div>
    );
  }
  const c = q.data!;

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/customers"
        className="mb-4 inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Customers
      </Link>

      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{c.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
            <Badge variant="outline" className="capitalize">
              {c.type}
            </Badge>
            {c.email && <span>{c.email}</span>}
            {c.phone && <span>· {c.phone}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="vehicles">Vehicles ({c.vehicles.length})</TabsTrigger>
          <TabsTrigger value="quotes">
            Quotes{quotesQuery.data ? ` (${quotesQuery.data.items.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="jobs">
            Jobs{jobsQuery.data ? ` (${jobsQuery.data.items.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="invoices" disabled>
            Invoices
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <InfoCard title="Contact">
              <Field label="Email" value={c.email} />
              <Field label="Phone" value={c.phone} />
              <Field label="Alt phone" value={c.altPhone} />
            </InfoCard>
            <InfoCard title="Address">
              <Field label="Line 1" value={c.addressLine1} />
              <Field label="Line 2" value={c.addressLine2} />
              <Field label="City" value={c.city} />
              <Field label="Region" value={c.region} />
              <Field label="Postal" value={c.postalCode} />
              <Field label="Country" value={c.country} />
            </InfoCard>
            <InfoCard title="Notes" className="md:col-span-2">
              <p className="text-sm whitespace-pre-wrap text-neutral-700 dark:text-neutral-300">
                {c.notes || <span className="text-neutral-500">No notes.</span>}
              </p>
            </InfoCard>
          </div>
        </TabsContent>

        <TabsContent value="vehicles" className="mt-4">
          <div className="mb-3 flex justify-end">
            <Button onClick={() => setAddVehicleOpen(true)} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add vehicle
            </Button>
          </div>
          {c.vehicles.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:bg-neutral-950">
              No vehicles yet.
            </div>
          ) : (
            <ul className="divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-950">
              {c.vehicles.map((v) => (
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
                          {v.plate && ` · ${v.plate}`}
                          {v.color && ` · ${v.color}`}
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="quotes" className="mt-4">
          <div className="mb-3 flex justify-end">
            <Link
              href={`/quotes/new?customerId=${c.id}`}
              className={cn(buttonVariants({ size: "sm" }))}
            >
              <Plus className="mr-2 h-4 w-4" />
              New quote
            </Link>
          </div>
          {quotesQuery.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : quotesQuery.data?.items.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              No quotes yet for this customer.
            </div>
          ) : (
            <ul className="divide-y overflow-hidden rounded-lg border bg-card">
              {quotesQuery.data?.items.map((quote) => (
                <li key={quote.id}>
                  <Link
                    href={`/quotes/${quote.id}`}
                    className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-accent/40"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm tabular-nums">
                            Q-{String(quote.number).padStart(4, "0")}
                          </span>
                          <QuoteStatusBadge status={quote.status} />
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(quote.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 font-mono text-sm tabular-nums">
                      {formatMoney(quote.totalCents, quote.currency)}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="jobs" className="mt-4">
          {jobsQuery.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : jobsQuery.data?.items.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              No jobs yet for this customer. They&apos;re auto-created when a quote is approved.
            </div>
          ) : (
            <ul className="divide-y overflow-hidden rounded-lg border bg-card">
              {jobsQuery.data?.items.map((job) => (
                <li key={job.id}>
                  <Link
                    href={`/jobs/${job.id}`}
                    className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-accent/40"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm tabular-nums">
                          J-{String(job.number).padStart(4, "0")}
                        </span>
                        <QuoteStatusBadge status={job.status} />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {job.title || job.summary || "no title"}
                      </div>
                    </div>
                    <div className="shrink-0 text-xs text-muted-foreground">
                      {new Date(job.createdAt).toLocaleDateString()}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          {timelineQuery.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : timelineQuery.data?.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:bg-neutral-950">
              No activity yet.
            </div>
          ) : (
            <ul className="space-y-2">
              {timelineQuery.data?.map((e) => (
                <li
                  key={e.id}
                  className="flex items-start gap-3 rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950"
                >
                  <div className="text-xs text-neutral-500 min-w-[7ch]">
                    {e.occurredAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">
                      {formatKind(e.kind)}
                      {e.actor && (
                        <span className="ml-2 text-xs font-normal text-neutral-500">
                          by {e.actor.name ?? e.actor.email}
                        </span>
                      )}
                    </div>
                    {Object.keys((e.data ?? {}) as Record<string, unknown>).length > 0 && (
                      <pre className="mt-1 text-[11px] text-neutral-500 whitespace-pre-wrap font-mono">
                        {JSON.stringify(e.data, null, 2)}
                      </pre>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      <AddVehicleDialog
        open={addVehicleOpen}
        onOpenChange={setAddVehicleOpen}
        customerId={c.id}
        onCreated={() => q.refetch()}
      />

      <EditCustomerDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        customer={c}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete customer?"
        description={`This soft-deletes ${c.name}. Their vehicles, quotes, and jobs stay in place but the customer disappears from the list. This action can be reversed by an admin.`}
        confirmLabel="Delete customer"
        onConfirm={async () => {
          try {
            await softDelete.mutateAsync({ id: c.id });
            await utils.customers.list.invalidate();
            toast.success("Customer deleted.");
            router.push("/customers");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Delete failed");
            throw err;
          }
        }}
      />
    </div>
  );
}

function InfoCard({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950 ${className ?? ""}`}
    >
      <h3 className="mb-3 text-xs font-medium uppercase tracking-widest text-neutral-500">
        {title}
      </h3>
      <dl className="space-y-1.5 text-sm">{children}</dl>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-right">
        {value || <span className="text-neutral-400">—</span>}
      </dd>
    </div>
  );
}

function formatKind(kind: string): string {
  return kind.replace(/_/g, " ").replace(/\./g, " · ");
}
