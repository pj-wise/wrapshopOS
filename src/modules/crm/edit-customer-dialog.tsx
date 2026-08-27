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
import { createCustomerInput } from "@/lib/schemas/crm";
import { trpc } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";

// Form validates against the create schema (partialized). `id` lives on the
// component prop instead of the form so we don't have to thread a hidden
// field through react-hook-form.
const editSchema = createCustomerInput.partial();
type Customer = RouterOutputs["customers"]["get"];
type FormValues = z.input<typeof editSchema>;

/**
 * Edit the top-level customer fields (contact + address + notes + type).
 * Vehicles are managed separately from the customer detail page.
 */
export function EditCustomerDialog({
  open,
  onOpenChange,
  customer,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer;
  onSaved?: () => void;
}) {
  const update = trpc.customers.update.useMutation();
  const utils = trpc.useUtils();

  const form = useForm<FormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: seedFromCustomer(customer),
  });

  // Reseed whenever the modal opens with a different customer (e.g. after
  // navigating between records without a full remount).
  useEffect(() => {
    if (open) form.reset(seedFromCustomer(customer));
  }, [open, customer, form]);

  const type = form.watch("type");

  async function onSubmit(values: FormValues) {
    try {
      await update.mutateAsync({ id: customer.id, ...values });
      toast.success("Customer updated.");
      onOpenChange(false);
      await Promise.all([
        utils.customers.get.invalidate({ id: customer.id }),
        utils.customers.list.invalidate(),
      ]);
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Edit customer</DialogTitle>
            <DialogDescription>
              Update contact info, address, and preferences.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <Label htmlFor="c-type">Type</Label>
              <Select
                value={type ?? "individual"}
                onValueChange={(v) => v && form.setValue("type", v as FormValues["type"])}
              >
                <SelectTrigger id="c-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <Label htmlFor="c-name">Name</Label>
              <Input id="c-name" {...form.register("name")} />
            </div>
            {type === "business" && (
              <div className="col-span-2">
                <Label htmlFor="c-biz">Business name</Label>
                <Input id="c-biz" {...form.register("businessName")} />
              </div>
            )}
            <div>
              <Label htmlFor="c-email">Email</Label>
              <Input id="c-email" type="email" {...form.register("email")} />
            </div>
            <div>
              <Label htmlFor="c-phone">Phone</Label>
              <Input id="c-phone" type="tel" {...form.register("phone")} />
            </div>
            <div>
              <Label htmlFor="c-alt">Alt phone</Label>
              <Input id="c-alt" type="tel" {...form.register("altPhone")} />
            </div>
            <div>
              <Label htmlFor="c-ref">Referral source</Label>
              <Input id="c-ref" {...form.register("referralSource")} />
            </div>
            <div className="col-span-2">
              <Label htmlFor="c-a1">Address line 1</Label>
              <Input id="c-a1" {...form.register("addressLine1")} />
            </div>
            <div className="col-span-2">
              <Label htmlFor="c-a2">Address line 2</Label>
              <Input id="c-a2" {...form.register("addressLine2")} />
            </div>
            <div>
              <Label htmlFor="c-city">City</Label>
              <Input id="c-city" {...form.register("city")} />
            </div>
            <div>
              <Label htmlFor="c-region">State / region</Label>
              <Input id="c-region" {...form.register("region")} />
            </div>
            <div>
              <Label htmlFor="c-zip">Postal code</Label>
              <Input id="c-zip" {...form.register("postalCode")} />
            </div>
            <div>
              <Label htmlFor="c-country">Country</Label>
              <Input id="c-country" maxLength={2} {...form.register("country")} />
            </div>
            <div className="col-span-2">
              <Label htmlFor="c-notes">Notes</Label>
              <Textarea id="c-notes" rows={3} {...form.register("notes")} />
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

function seedFromCustomer(c: Customer): FormValues {
  return {
    type: c.type as FormValues["type"],
    name: c.name,
    businessName: c.businessName ?? undefined,
    email: c.email ?? undefined,
    phone: c.phone ?? undefined,
    altPhone: c.altPhone ?? undefined,
    addressLine1: c.addressLine1 ?? undefined,
    addressLine2: c.addressLine2 ?? undefined,
    city: c.city ?? undefined,
    region: c.region ?? undefined,
    postalCode: c.postalCode ?? undefined,
    country: c.country ?? "US",
    notes: c.notes ?? undefined,
    referralSource: c.referralSource ?? undefined,
  };
}
