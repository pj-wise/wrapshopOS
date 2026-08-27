"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Car, Pencil, Trash2, User } from "lucide-react";

import { trpc } from "@/lib/trpc/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EditVehicleDialog } from "./edit-vehicle-dialog";

export function VehicleDetail({ id }: { id: string }) {
  const router = useRouter();
  const q = trpc.vehicles.get.useQuery({ id });
  const softDelete = trpc.vehicles.softDelete.useMutation();
  const utils = trpc.useUtils();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (q.isLoading) return <Skeleton className="h-32 max-w-6xl mx-auto" />;
  if (q.error) return <p className="text-sm text-red-600 mx-auto max-w-6xl">{q.error.message}</p>;
  const v = q.data!;

  const title = [v.year, v.make, v.model, v.trim].filter(Boolean).join(" ") || "(unnamed vehicle)";

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/vehicles"
        className="mb-4 inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Vehicles
      </Link>

      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Car className="h-5 w-5 text-neutral-500" />
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
            {v.vin && <Badge variant="outline" className="font-mono">VIN {v.vin}</Badge>}
            {v.plate && <Badge variant="outline">{v.plate}</Badge>}
            {v.color && <span>· {v.color}</span>}
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <InfoCard title="Vehicle">
          <Field label="Year" value={v.year?.toString()} />
          <Field label="Make" value={v.make} />
          <Field label="Model" value={v.model} />
          <Field label="Trim" value={v.trim} />
          <Field label="Body style" value={v.bodyStyle} />
          <Field label="Color" value={v.color} />
          <Field label="Mileage" value={v.mileage?.toLocaleString()} />
        </InfoCard>

        <InfoCard title="Identifiers">
          <Field label="VIN" value={v.vin} mono />
          <Field label="Plate" value={v.plate} />
          <Field label="Plate state" value={v.plateState} />
        </InfoCard>

        <InfoCard title="Customer" className="md:col-span-2">
          {v.customer ? (
            <Link
              href={`/customers/${v.customer.id}`}
              className="inline-flex items-center gap-2 text-sm hover:underline"
            >
              <User className="h-4 w-4 text-neutral-500" />
              {v.customer.name}
            </Link>
          ) : (
            <p className="text-sm text-neutral-500">Not attached to a customer.</p>
          )}
        </InfoCard>

        {v.notes && (
          <InfoCard title="Notes" className="md:col-span-2">
            <p className="text-sm whitespace-pre-wrap text-neutral-700 dark:text-neutral-300">
              {v.notes}
            </p>
          </InfoCard>
        )}
      </div>

      <EditVehicleDialog open={editOpen} onOpenChange={setEditOpen} vehicle={v} />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete vehicle?"
        description={`Soft-deletes ${title}. Related quotes, jobs, and warranties keep their references — only this vehicle record disappears from the list.`}
        confirmLabel="Delete vehicle"
        onConfirm={async () => {
          try {
            await softDelete.mutateAsync({ id: v.id });
            await utils.vehicles.list.invalidate();
            if (v.customer) await utils.customers.get.invalidate({ id: v.customer.id });
            toast.success("Vehicle deleted.");
            router.push(v.customer ? `/customers/${v.customer.id}` : "/vehicles");
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
      <h3 className="mb-3 text-xs font-medium uppercase tracking-widest text-neutral-500">{title}</h3>
      <dl className="space-y-1.5 text-sm">{children}</dl>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-neutral-500">{label}</dt>
      <dd className={`text-right ${mono ? "font-mono" : ""}`}>
        {value || <span className="text-neutral-400">—</span>}
      </dd>
    </div>
  );
}
