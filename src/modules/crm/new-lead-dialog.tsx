"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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

type FormValues = z.input<typeof createLeadInput>;

export function NewLeadDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: string) => void;
}) {
  const router = useRouter();
  const create = trpc.leads.create.useMutation();
  const utils = trpc.useUtils();

  const form = useForm<FormValues>({
    resolver: zodResolver(createLeadInput),
    defaultValues: {
      name: "",
      source: "website",
      status: "new",
      requestedServices: [],
      tags: [],
      email: "",
      phone: "",
      vehicleDescription: "",
      notes: "",
    },
  });

  const source = form.watch("source");

  async function onSubmit(values: FormValues) {
    try {
      const created = await create.mutateAsync(values);
      toast.success("Lead logged.");
      form.reset();
      onOpenChange(false);
      await utils.leads.list.invalidate();
      onCreated?.(created.id);
      router.push(`/leads/${created.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <DialogHeader>
            <DialogTitle>New lead</DialogTitle>
            <DialogDescription>
              Log an inbound. Convert to a customer + vehicle when they book.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" placeholder="Marcus Chen" {...form.register("name")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...form.register("email")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" type="tel" {...form.register("phone")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="source">Source</Label>
              <Select
                value={source}
                onValueChange={(v) => form.setValue("source", v as FormValues["source"])}
              >
                <SelectTrigger id="source">
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
            <div className="space-y-1.5">
              <Label htmlFor="budgetCents">Budget (USD)</Label>
              <Input
                id="budgetCents"
                type="number"
                placeholder="4500"
                onChange={(e) =>
                  form.setValue(
                    "budgetCents",
                    e.target.value ? Math.round(Number(e.target.value) * 100) : null,
                  )
                }
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vehicleDescription">Vehicle interest</Label>
            <Input
              id="vehicleDescription"
              placeholder="2024 M4 — satin dark gray full wrap + front PPF"
              {...form.register("vehicleDescription")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={3} {...form.register("notes")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Saving…" : "Log lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
