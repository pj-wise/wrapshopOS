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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";
import { centsFromDollars, formatMoney } from "@/lib/money";

export function RecordPaymentDialog({
  open,
  onOpenChange,
  invoiceId,
  maxAmountCents,
  currency,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  invoiceId: string;
  maxAmountCents: number;
  currency: string;
  onDone: () => Promise<void>;
}) {
  const [amount, setAmount] = useState((maxAmountCents / 100).toFixed(2));
  const [method, setMethod] =
    useState<"card" | "ach" | "cash" | "check" | "qbo" | "other">("cash");
  const [ref, setRef] = useState("");
  const [notes, setNotes] = useState("");
  const record = trpc.payments.record.useMutation();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await record.mutateAsync({
        invoiceId,
        amountCents: centsFromDollars(Number(amount)),
        method,
        referenceNumber: ref || undefined,
        notes: notes || undefined,
      });
      toast.success("Payment recorded.");
      onOpenChange(false);
      await onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
            <DialogDescription>
              Log a manual payment (cash / check / card / ACH). QuickBooks-received payments land here
              automatically via webhook.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amt">Amount ({currency})</Label>
              <Input
                id="amt"
                type="number"
                step="0.01"
                min="0.01"
                max={(maxAmountCents / 100).toString()}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="text-right tabular-nums"
              />
              <p className="text-[10px] text-muted-foreground">
                Balance remaining {formatMoney(maxAmountCents, currency)}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Method</Label>
              <Select value={method} onValueChange={(v) => v && setMethod(v as typeof method)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="card">Card (external)</SelectItem>
                  <SelectItem value="ach">ACH</SelectItem>
                  <SelectItem value="qbo">QuickBooks</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ref">Reference (check # / auth code)</Label>
            <Input id="ref" value={ref} onChange={(e) => setRef(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={record.isPending}>
              {record.isPending ? "Saving…" : "Record"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
