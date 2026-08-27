"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, RotateCcw } from "lucide-react";

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
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc/client";

type DecodedForm = {
  year: string;
  make: string;
  model: string;
  trim: string;
  bodyStyle: string;
  color: string;
  plate: string;
  mileage: string;
  notes: string;
  raw: Record<string, unknown>;
};

const EMPTY: DecodedForm = {
  year: "",
  make: "",
  model: "",
  trim: "",
  bodyStyle: "",
  color: "",
  plate: "",
  mileage: "",
  notes: "",
  raw: {},
};

/**
 * Two-step flow:
 *   1. Enter VIN → hit `vehicles.decodeVin`. Show decoded fields as an editable
 *      preview (user can correct anything; NHTSA sometimes returns wrong trim).
 *   2. Confirm → `vehicles.create` with customerId attached.
 *
 * Manual entry: skip VIN or leave blank and edit fields directly, then Save.
 */
export function AddVehicleDialog({
  open,
  onOpenChange,
  customerId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId?: string;
  onCreated?: (id: string) => void;
}) {
  const [vin, setVin] = useState("");
  const [decoding, setDecoding] = useState(false);
  const [form, setForm] = useState<DecodedForm>(EMPTY);
  const [decoded, setDecoded] = useState(false);

  const decodeVin = trpc.vehicles.decodeVin.useQuery(
    { vin: vin.trim() },
    { enabled: false },
  );
  const create = trpc.vehicles.create.useMutation();
  const utils = trpc.useUtils();

  async function onDecode() {
    if (vin.trim().length !== 17) {
      toast.error("VIN must be 17 characters.");
      return;
    }
    setDecoding(true);
    try {
      const res = await decodeVin.refetch();
      if (res.data?.ok) {
        const d = res.data.decoded;
        setForm({
          year: d.year?.toString() ?? "",
          make: d.make ?? "",
          model: d.model ?? "",
          trim: d.trim ?? "",
          bodyStyle: d.bodyClass ?? "",
          color: "",
          plate: "",
          mileage: "",
          notes: d.errors.length > 0 ? `Decode warnings: ${d.errors.join(" · ")}` : "",
          raw: d.raw as Record<string, unknown>,
        });
        setDecoded(true);
      } else {
        toast.error(res.data?.ok === false ? res.data.error : "Decode failed");
      }
    } finally {
      setDecoding(false);
    }
  }

  async function onSave() {
    try {
      const created = await create.mutateAsync({
        customerId,
        vin: vin.trim() || undefined,
        year: form.year ? Number(form.year) : null,
        make: form.make || undefined,
        model: form.model || undefined,
        trim: form.trim || undefined,
        bodyStyle: form.bodyStyle || undefined,
        color: form.color || undefined,
        plate: form.plate || undefined,
        mileage: form.mileage ? Number(form.mileage) : null,
        notes: form.notes || undefined,
        decodedData: form.raw,
      });
      toast.success("Vehicle added.");
      reset();
      onOpenChange(false);
      await Promise.all([
        utils.vehicles.list.invalidate(),
        customerId ? utils.customers.get.invalidate({ id: customerId }) : Promise.resolve(),
      ]);
      onCreated?.(created.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  }

  function reset() {
    setVin("");
    setForm(EMPTY);
    setDecoded(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add vehicle</DialogTitle>
          <DialogDescription>
            Enter a VIN to auto-decode, or fill fields manually.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="vin">VIN</Label>
            <div className="flex gap-2">
              <Input
                id="vin"
                value={vin}
                maxLength={17}
                onChange={(e) => setVin(e.target.value.toUpperCase())}
                placeholder="17-character VIN"
                className="font-mono uppercase tracking-wider"
                autoComplete="off"
                autoFocus
              />
              <Button
                type="button"
                variant="outline"
                onClick={onDecode}
                disabled={decoding || vin.trim().length !== 17}
              >
                {decoding ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : decoded ? (
                  <RotateCcw className="h-4 w-4" />
                ) : (
                  "Decode"
                )}
              </Button>
            </div>
            {decoded && (
              <p className="flex items-center gap-1 text-xs text-emerald-600">
                <CheckCircle2 className="h-3 w-3" />
                Decoded — review and adjust below.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Year" value={form.year} onChange={(v) => setForm({ ...form, year: v })} type="number" />
            <FormField label="Make" value={form.make} onChange={(v) => setForm({ ...form, make: v })} />
            <FormField label="Model" value={form.model} onChange={(v) => setForm({ ...form, model: v })} />
            <FormField label="Trim" value={form.trim} onChange={(v) => setForm({ ...form, trim: v })} />
            <FormField label="Body style" value={form.bodyStyle} onChange={(v) => setForm({ ...form, bodyStyle: v })} />
            <FormField label="Color" value={form.color} onChange={(v) => setForm({ ...form, color: v })} />
            <FormField label="Plate" value={form.plate} onChange={(v) => setForm({ ...form, plate: v })} />
            <FormField label="Mileage" value={form.mileage} onChange={(v) => setForm({ ...form, mileage: v })} type="number" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={onSave} disabled={create.isPending}>
            {create.isPending ? "Saving…" : "Save vehicle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FormField({
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
    <div className="space-y-1">
      <Label className="text-xs text-neutral-500">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} type={type} />
    </div>
  );
}
