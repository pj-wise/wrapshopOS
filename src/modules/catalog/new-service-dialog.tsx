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
import { trpc } from "@/lib/trpc/client";
import {
  buildServicePayload,
  EMPTY_FORM,
  ServiceForm,
  type ServiceFormState,
} from "./service-form";

export function NewServiceDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (id: string) => void;
}) {
  const create = trpc.services.create.useMutation();
  const utils = trpc.useUtils();
  const [form, setForm] = useState<ServiceFormState>(EMPTY_FORM);

  function reset() {
    setForm(EMPTY_FORM);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // React portals propagate synthetic events through the React tree, so
    // this submit would otherwise bubble up to any parent <form> (e.g. the
    // QuoteBuilder when this dialog is opened from the "+ New product"
    // picker), triggering its onSubmit prematurely.
    e.stopPropagation();
    try {
      const created = await create.mutateAsync(buildServicePayload(form));
      toast.success(`Product "${created.name}" added.`);
      reset();
      onOpenChange(false);
      await utils.services.list.invalidate();
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
            <DialogTitle>New product</DialogTitle>
            <DialogDescription>
              Add a product or service you sell. Pricing model drives how quotes
              calculate line totals.
            </DialogDescription>
          </DialogHeader>

          <div className="-mx-4 min-h-0 flex-1 overflow-y-auto px-4">
            <ServiceForm value={form} onChange={(p) => setForm((s) => ({ ...s, ...p }))} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending || !form.name}>
              {create.isPending ? "Creating…" : "Create product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
