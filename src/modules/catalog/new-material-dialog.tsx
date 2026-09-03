"use client";

import { useState } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";
import { centsFromDollars } from "@/lib/money";

const CATEGORIES = [
  { value: "vinyl", label: "Vinyl" },
  { value: "clear_ppf", label: "Clear PPF" },
  { value: "colored_ppf", label: "Colored PPF" },
  { value: "matte_ppf", label: "Matte PPF" },
  { value: "tint", label: "Tint" },
  { value: "ceramic", label: "Ceramic" },
  { value: "laminate", label: "Laminate" },
  { value: "print_media", label: "Print media" },
  { value: "other", label: "Other" },
] as const;

const FINISHES = [
  { value: "gloss", label: "Gloss" },
  { value: "satin", label: "Satin" },
  { value: "matte", label: "Matte" },
  { value: "metallic", label: "Metallic" },
  { value: "chrome", label: "Chrome" },
] as const;

// Sentinel for "no selection" — Radix's SelectItem forbids empty-string values.
const NONE = "__none__";

type FormState = {
  name: string;
  category: string;
  manufacturer: string;
  series: string;
  color: string;
  finish: string;
  widthIn: string;
  costPerFootDollars: string;
  vendorId: string;
  sku: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  category: "",
  manufacturer: "",
  series: "",
  color: "",
  finish: "",
  widthIn: "",
  costPerFootDollars: "",
  vendorId: NONE,
  sku: "",
  notes: "",
};

export function NewMaterialDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (id: string) => void;
}) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const create = trpc.materials.create.useMutation();
  const vendorsQ = trpc.materials.listVendors.useQuery(undefined, { enabled: open });
  const utils = trpc.useUtils();

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((s) => ({ ...s, [key]: value }));
  }

  function reset() {
    setForm(EMPTY_FORM);
  }

  const canSubmit = form.name.trim().length > 0 && form.category.length > 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!canSubmit) return;

    const widthIn = form.widthIn.trim() ? Number(form.widthIn) : null;
    const costDollars = form.costPerFootDollars.trim()
      ? Number(form.costPerFootDollars)
      : null;
    const costPerFootCents =
      costDollars != null && Number.isFinite(costDollars)
        ? centsFromDollars(costDollars)
        : null;

    try {
      const created = await create.mutateAsync({
        name: form.name.trim(),
        category: form.category as (typeof CATEGORIES)[number]["value"],
        manufacturer: form.manufacturer.trim() || undefined,
        series: form.series.trim() || undefined,
        color: form.color.trim() || undefined,
        finish: form.finish ? form.finish : undefined,
        widthIn: widthIn != null && Number.isFinite(widthIn) ? widthIn : undefined,
        costPerFootCents: costPerFootCents ?? undefined,
        vendorId: form.vendorId === NONE ? null : form.vendorId,
        sku: form.sku.trim() || undefined,
        notes: form.notes.trim() || undefined,
        active: true,
      });
      toast.success(`Material "${created.name}" added.`);
      reset();
      onOpenChange(false);
      await utils.materials.list.invalidate();
      onCreated?.(created.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    }
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
        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col gap-4">
          <DialogHeader>
            <DialogTitle>New material</DialogTitle>
            <DialogDescription>
              Add a film, PPF, tint, or ceramic product to your inventory. Rolls
              of this material can be tracked on the detail page after creation.
            </DialogDescription>
          </DialogHeader>

          <div className="-mx-4 min-h-0 flex-1 space-y-3 overflow-y-auto px-4">
            <div>
              <Label htmlFor="mat-name">Name *</Label>
              <Input
                id="mat-name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. 3M 2080 Satin Black"
                required
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="mat-category">Category *</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => set("category", v ?? "")}
                >
                  <SelectTrigger id="mat-category">
                    <SelectValue placeholder="Pick one" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="mat-manufacturer">Manufacturer</Label>
                <Input
                  id="mat-manufacturer"
                  value={form.manufacturer}
                  onChange={(e) => set("manufacturer", e.target.value)}
                  placeholder="3M, Avery, XPEL…"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="mat-series">Series</Label>
                <Input
                  id="mat-series"
                  value={form.series}
                  onChange={(e) => set("series", e.target.value)}
                  placeholder="2080, SW900…"
                />
              </div>
              <div>
                <Label htmlFor="mat-color">Color</Label>
                <Input
                  id="mat-color"
                  value={form.color}
                  onChange={(e) => set("color", e.target.value)}
                  placeholder="Satin Black"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="mat-finish">Finish</Label>
                <Select
                  value={form.finish || NONE}
                  onValueChange={(v) => set("finish", !v || v === NONE ? "" : v)}
                >
                  <SelectTrigger id="mat-finish">
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>—</SelectItem>
                    {FINISHES.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="mat-vendor">Vendor</Label>
                <Select
                  value={form.vendorId}
                  onValueChange={(v) => set("vendorId", v ?? NONE)}
                >
                  <SelectTrigger id="mat-vendor">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {(vendorsQ.data ?? []).map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="mat-width">Width (in)</Label>
                <Input
                  id="mat-width"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.5}
                  value={form.widthIn}
                  onChange={(e) => set("widthIn", e.target.value)}
                  placeholder="60"
                />
              </div>
              <div>
                <Label htmlFor="mat-cost">Cost per foot ($)</Label>
                <Input
                  id="mat-cost"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.01}
                  value={form.costPerFootDollars}
                  onChange={(e) => set("costPerFootDollars", e.target.value)}
                  placeholder="3.20"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="mat-sku">SKU</Label>
              <Input
                id="mat-sku"
                value={form.sku}
                onChange={(e) => set("sku", e.target.value)}
                placeholder="Optional"
              />
            </div>

            <div>
              <Label htmlFor="mat-notes">Notes</Label>
              <Textarea
                id="mat-notes"
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                rows={2}
                placeholder="Anything the shop should know about this material."
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit || create.isPending}>
              {create.isPending ? "Creating…" : "Create material"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
