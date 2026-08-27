"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";

type Vehicle = RouterOutputs["vehicles"]["get"];

type Form = {
  vin: string;
  year: string;
  make: string;
  model: string;
  trim: string;
  bodyStyle: string;
  color: string;
  plate: string;
  plateState: string;
  mileage: string;
  notes: string;
};

/**
 * Edits the free-form vehicle fields. Doesn't offer VIN re-decoding here —
 * that's an "Add vehicle" flow only; once persisted, decoded data is
 * authoritative but the user can still override individual fields.
 */
export function EditVehicleDialog({
  open,
  onOpenChange,
  vehicle,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: Vehicle;
  onSaved?: () => void;
}) {
  const update = trpc.vehicles.update.useMutation();
  const utils = trpc.useUtils();
  const [form, setForm] = useState<Form>(() => seedFromVehicle(vehicle));

  useEffect(() => {
    if (open) setForm(seedFromVehicle(vehicle));
  }, [open, vehicle]);

  async function onSave() {
    try {
      await update.mutateAsync({
        id: vehicle.id,
        vin: form.vin.trim() || undefined,
        year: form.year ? Number(form.year) : null,
        make: form.make || undefined,
        model: form.model || undefined,
        trim: form.trim || undefined,
        bodyStyle: form.bodyStyle || undefined,
        color: form.color || undefined,
        plate: form.plate || undefined,
        plateState: form.plateState || undefined,
        mileage: form.mileage ? Number(form.mileage) : null,
        notes: form.notes || undefined,
      });
      toast.success("Vehicle updated.");
      onOpenChange(false);
      await Promise.all([
        utils.vehicles.get.invalidate({ id: vehicle.id }),
        utils.vehicles.list.invalidate(),
        vehicle.customer
          ? utils.customers.get.invalidate({ id: vehicle.customer.id })
          : Promise.resolve(),
      ]);
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit vehicle</DialogTitle>
          <DialogDescription>Adjust vehicle details and identifiers.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="v-vin">VIN</Label>
            <Input
              id="v-vin"
              maxLength={17}
              value={form.vin}
              onChange={(e) => setForm({ ...form, vin: e.target.value.toUpperCase() })}
              className="font-mono uppercase"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Year"
              type="number"
              value={form.year}
              onChange={(v) => setForm({ ...form, year: v })}
            />
            <Field label="Make" value={form.make} onChange={(v) => setForm({ ...form, make: v })} />
            <Field label="Model" value={form.model} onChange={(v) => setForm({ ...form, model: v })} />
            <Field label="Trim" value={form.trim} onChange={(v) => setForm({ ...form, trim: v })} />
            <Field
              label="Body style"
              value={form.bodyStyle}
              onChange={(v) => setForm({ ...form, bodyStyle: v })}
            />
            <Field label="Color" value={form.color} onChange={(v) => setForm({ ...form, color: v })} />
            <Field label="Plate" value={form.plate} onChange={(v) => setForm({ ...form, plate: v })} />
            <Field
              label="Plate state"
              value={form.plateState}
              onChange={(v) => setForm({ ...form, plateState: v })}
            />
            <Field
              label="Mileage"
              type="number"
              value={form.mileage}
              onChange={(v) => setForm({ ...form, mileage: v })}
            />
          </div>
          <div>
            <Label htmlFor="v-notes">Notes</Label>
            <Textarea
              id="v-notes"
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={onSave} disabled={update.isPending}>
            {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function seedFromVehicle(v: Vehicle): Form {
  return {
    vin: v.vin ?? "",
    year: v.year?.toString() ?? "",
    make: v.make ?? "",
    model: v.model ?? "",
    trim: v.trim ?? "",
    bodyStyle: v.bodyStyle ?? "",
    color: v.color ?? "",
    plate: v.plate ?? "",
    plateState: v.plateState ?? "",
    mileage: v.mileage?.toString() ?? "",
    notes: v.notes ?? "",
  };
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <Label className="text-xs text-neutral-500">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} type={type} />
    </div>
  );
}
