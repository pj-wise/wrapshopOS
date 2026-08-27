"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { z } from "zod";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LEAD_SOURCES } from "@/lib/crm-catalog";
import { createLeadInput } from "@/lib/schemas/crm";
import { trpc } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";

const editSchema = createLeadInput.partial();
type Lead = RouterOutputs["leads"]["get"];
type FormValues = z.input<typeof editSchema>;

export function EditLeadDialog({
  open,
  onOpenChange,
  lead,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead;
  onSaved?: () => void;
}) {
  const update = trpc.leads.update.useMutation();
  const utils = trpc.useUtils();

  const form = useForm<FormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: seedFromLead(lead),
  });

  useEffect(() => {
    if (open) form.reset(seedFromLead(lead));
  }, [open, lead, form]);

  const source = form.watch("source");

  async function onSubmit(values: FormValues) {
    try {
      await update.mutateAsync({ id: lead.id, ...values });
      toast.success("Lead updated.");
      onOpenChange(false);
      await Promise.all([
        utils.leads.get.invalidate({ id: lead.id }),
        utils.leads.list.invalidate(),
      ]);
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Edit lead</DialogTitle>
            <DialogDescription>Update the lead&apos;s info and interest.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label htmlFor="l-name">Name</Label>
              <Input id="l-name" {...form.register("name")} />
            </div>
            <div>
              <Label htmlFor="l-email">Email</Label>
              <Input id="l-email" type="email" {...form.register("email")} />
            </div>
            <div>
              <Label htmlFor="l-phone">Phone</Label>
              <Input id="l-phone" type="tel" {...form.register("phone")} />
            </div>
            <div>
              <Label htmlFor="l-source">Source</Label>
              <Select
                value={source}
                onValueChange={(v) => v && form.setValue("source", v as FormValues["source"])}
              >
                <SelectTrigger id="l-source" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_SOURCES.map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="l-budget">Budget (USD)</Label>
              <Input
                id="l-budget"
                type="number"
                defaultValue={lead.budgetCents ? lead.budgetCents / 100 : ""}
                onChange={(e) =>
                  form.setValue(
                    "budgetCents",
                    e.target.value ? Math.round(Number(e.target.value) * 100) : null,
                  )
                }
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="l-vehicle">Vehicle interest</Label>
              <Input id="l-vehicle" {...form.register("vehicleDescription")} />
            </div>
            <div className="col-span-2">
              <Label htmlFor="l-notes">Notes</Label>
              <Textarea id="l-notes" rows={3} {...form.register("notes")} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function seedFromLead(l: Lead): FormValues {
  return {
    name: l.name,
    email: l.email ?? undefined,
    phone: l.phone ?? undefined,
    source: l.source as FormValues["source"],
    budgetCents: l.budgetCents ?? null,
    vehicleDescription: l.vehicleDescription ?? undefined,
    notes: l.notes ?? undefined,
    requestedServices: l.requestedServices,
    tags: l.tags,
  };
}
