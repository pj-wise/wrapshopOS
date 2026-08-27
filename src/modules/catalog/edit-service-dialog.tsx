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
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import {
  buildServicePayload,
  formStateFromService,
  ServiceForm,
  type ServiceFormState,
} from "./service-form";

type Service = RouterOutputs["services"]["list"][number];

export function EditServiceDialog({
  open,
  onOpenChange,
  service,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  service: Service;
  onSaved?: () => void;
}) {
  const update = trpc.services.update.useMutation();
  const utils = trpc.useUtils();
  const [form, setForm] = useState<ServiceFormState>(() =>
    formStateFromService(service),
  );

  useEffect(() => {
    if (open) setForm(formStateFromService(service));
  }, [open, service]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Portals propagate synthetic events through the React tree. Stop the
    // submit here so it never reaches any parent <form> (e.g. QuoteBuilder).
    e.stopPropagation();
    try {
      await update.mutateAsync({ id: service.id, ...buildServicePayload(form) });
      toast.success("Product updated.");
      onOpenChange(false);
      await utils.services.list.invalidate();
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Edit product</DialogTitle>
            <DialogDescription>
              Update pricing, description, labor cost, or activation status.
            </DialogDescription>
          </DialogHeader>

          <div className="-mx-4 min-h-0 flex-1 overflow-y-auto px-4">
            <ServiceForm value={form} onChange={(p) => setForm((s) => ({ ...s, ...p }))} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={update.isPending || !form.name}>
              {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
