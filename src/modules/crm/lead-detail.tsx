"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Car, Pencil, Trash2, User } from "lucide-react";

import { trpc } from "@/lib/trpc/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LEAD_STAGES, leadSourceLabel, leadStageLabel } from "@/lib/crm-catalog";
import { EditLeadDialog } from "./edit-lead-dialog";

export function LeadDetail({ id }: { id: string }) {
  const router = useRouter();
  const [convertOpen, setConvertOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const q = trpc.leads.get.useQuery({ id });
  const update = trpc.leads.update.useMutation();
  const softDelete = trpc.leads.softDelete.useMutation();
  const utils = trpc.useUtils();

  async function setStage(status: string) {
    try {
      await update.mutateAsync({ id, status });
      toast.success(`Moved to ${leadStageLabel(status)}.`);
      await utils.leads.get.invalidate({ id });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  if (q.isLoading) return <Skeleton className="h-32 max-w-6xl mx-auto" />;
  if (q.error) return <p className="text-sm text-red-600 mx-auto max-w-6xl">{q.error.message}</p>;
  const l = q.data!;
  const converted = Boolean(l.convertedCustomerId);

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/leads"
        className="mb-4 inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Leads
      </Link>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{l.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
            <Badge variant="outline">{leadSourceLabel(l.source)}</Badge>
            {l.email && <span>{l.email}</span>}
            {l.phone && <span>· {l.phone}</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={l.status}
            onValueChange={(v) => v && setStage(v)}
            disabled={converted}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEAD_STAGES.map((s) => (
                <SelectItem key={s.key} value={s.key}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          <Button onClick={() => setConvertOpen(true)} disabled={converted}>
            Convert
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>

      {converted && (
        <div className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm dark:border-emerald-800 dark:bg-emerald-950">
          <p className="font-medium text-emerald-900 dark:text-emerald-200">
            Lead converted.
          </p>
          <div className="mt-2 flex flex-wrap gap-3 text-sm">
            {l.convertedCustomer && (
              <Link
                href={`/customers/${l.convertedCustomer.id}`}
                className="inline-flex items-center gap-1 text-emerald-900 hover:underline dark:text-emerald-200"
              >
                <User className="h-3.5 w-3.5" />
                {l.convertedCustomer.name}
              </Link>
            )}
            {l.convertedVehicle && (
              <Link
                href={`/vehicles/${l.convertedVehicle.id}`}
                className="inline-flex items-center gap-1 text-emerald-900 hover:underline dark:text-emerald-200"
              >
                <Car className="h-3.5 w-3.5" />
                {[l.convertedVehicle.year, l.convertedVehicle.make, l.convertedVehicle.model]
                  .filter(Boolean)
                  .join(" ") || l.convertedVehicle.vin || "vehicle"}
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <InfoCard title="Interest">
          <Field label="Requested" value={l.requestedServices.join(", ") || null} />
          <Field label="Budget" value={l.budgetCents ? `$${(l.budgetCents / 100).toLocaleString()}` : null} />
          <Field label="Vehicle" value={l.vehicleDescription} />
        </InfoCard>
        <InfoCard title="Follow-up">
          <Field
            label="Assigned"
            value={l.assignedToUserId ? "Yes" : null}
          />
          <Field
            label="Follow-up at"
            value={l.followUpAt ? new Date(l.followUpAt).toLocaleString() : null}
          />
          <Field
            label="Created"
            value={new Date(l.createdAt).toLocaleString()}
          />
        </InfoCard>
        <InfoCard title="Notes" className="md:col-span-2">
          <p className="text-sm whitespace-pre-wrap text-neutral-700 dark:text-neutral-300">
            {l.notes || <span className="text-neutral-500">No notes.</span>}
          </p>
        </InfoCard>
      </div>

      <ConvertLeadDialog
        open={convertOpen}
        onOpenChange={setConvertOpen}
        leadId={l.id}
        onDone={async (result) => {
          await utils.leads.get.invalidate({ id });
          router.push(`/customers/${result.customer.id}`);
        }}
      />

      <EditLeadDialog open={editOpen} onOpenChange={setEditOpen} lead={l} />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete lead?"
        description={`Soft-deletes ${l.name}. Any linked timeline events are preserved for auditing.`}
        confirmLabel="Delete lead"
        onConfirm={async () => {
          try {
            await softDelete.mutateAsync({ id: l.id });
            await utils.leads.list.invalidate();
            toast.success("Lead deleted.");
            router.push("/leads");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Delete failed");
            throw err;
          }
        }}
      />
    </div>
  );
}

function ConvertLeadDialog({
  open,
  onOpenChange,
  leadId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leadId: string;
  onDone: (result: {
    customer: { id: string };
    vehicle: { id: string } | null;
  }) => Promise<void>;
}) {
  const [customerType, setCustomerType] = useState<"individual" | "business">("individual");
  const [vin, setVin] = useState("");
  const [createEmptyVehicle, setCreateEmptyVehicle] = useState(true);
  const convert = trpc.leads.convert.useMutation();

  async function onSubmit() {
    try {
      const res = await convert.mutateAsync({
        id: leadId,
        customerType,
        vin: vin.trim() || undefined,
        createEmptyVehicle,
      });
      toast.success("Lead converted to customer.");
      onOpenChange(false);
      await onDone(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Convert failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convert lead to customer</DialogTitle>
          <DialogDescription>
            Creates a customer, optionally with a vehicle (decoded from VIN if provided).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Customer type</Label>
            <Select
              value={customerType}
              onValueChange={(v) => setCustomerType(v as "individual" | "business")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="individual">Individual</SelectItem>
                <SelectItem value="business">Business</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vin">VIN (optional)</Label>
            <Input
              id="vin"
              value={vin}
              maxLength={17}
              onChange={(e) => setVin(e.target.value.toUpperCase())}
              placeholder="If provided, we decode + attach a vehicle"
              className="font-mono uppercase"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={createEmptyVehicle}
              onChange={(e) => setCreateEmptyVehicle(e.target.checked)}
            />
            Create a vehicle stub even without a VIN
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={convert.isPending}>
            {convert.isPending ? "Converting…" : "Convert"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-right">{value || <span className="text-neutral-400">—</span>}</dd>
    </div>
  );
}
