"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Package, Plus } from "lucide-react";

import { trpc } from "@/lib/trpc/client";
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
import { formatMoney } from "@/lib/money";

/**
 * Materials-used widget on the job detail page. Lists prior deductions for
 * this job + opens a dialog to deduct more.
 */
export function MaterialsUsedPanel({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false);
  const txQ = trpc.inventory.listTransactions.useQuery({ jobId });

  const rows = (txQ.data ?? []).filter(
    (t) => t.kind === "deduct" || t.kind === "waste",
  );
  const totalCostCents = rows.reduce((s, r) => s + r.costCents, 0);
  const totalYd = rows.reduce((s, r) => s + Number(r.lengthYd), 0);

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Materials used
        </h3>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Deduct roll
        </Button>
      </div>

      {txQ.isLoading ? (
        <Skeleton className="m-4 h-16" />
      ) : rows.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          <Package className="mx-auto mb-2 h-5 w-5 opacity-40" />
          No material use logged yet.
        </div>
      ) : (
        <>
          <ul className="divide-y">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-4 px-4 py-2 text-sm"
              >
                <div className="min-w-0">
                  <div className="truncate">
                    {r.roll.material.manufacturer
                      ? `${r.roll.material.manufacturer} · `
                      : ""}
                    {r.roll.material.name}
                  </div>
                  {r.notes && (
                    <div className="text-xs text-muted-foreground truncate">
                      {r.notes}
                    </div>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-mono tabular-nums text-sm">
                    {Number(r.lengthYd).toFixed(2)} yd
                  </div>
                  <div className="font-mono tabular-nums text-xs text-muted-foreground">
                    {formatMoney(r.costCents)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t bg-muted/30 px-4 py-2 text-sm">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              Total
            </span>
            <span className="font-mono tabular-nums">
              {totalYd.toFixed(2)} yd · {formatMoney(totalCostCents)}
            </span>
          </div>
        </>
      )}

      <DeductRollDialog
        jobId={jobId}
        open={open}
        onOpenChange={setOpen}
        onDone={() => txQ.refetch()}
      />
    </div>
  );
}

function DeductRollDialog({
  jobId,
  open,
  onOpenChange,
  onDone,
}: {
  jobId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}) {
  const [rollId, setRollId] = useState<string>("");
  const [lengthYd, setLengthYd] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [kind, setKind] = useState<"deduct" | "waste">("deduct");
  const rolls = trpc.materials.listRolls.useQuery();
  const deduct = trpc.inventory.deductRoll.useMutation();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rollId) {
      toast.error("Pick a roll.");
      return;
    }
    try {
      await deduct.mutateAsync({
        materialRollId: rollId,
        jobId,
        lengthYd: Number(lengthYd),
        kind,
        notes: notes || undefined,
      });
      toast.success(`Deducted ${lengthYd} yd.`);
      onOpenChange(false);
      setRollId("");
      setLengthYd("");
      setNotes("");
      setKind("deduct");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Deduct from roll</DialogTitle>
            <DialogDescription>
              Records material used against this job + drops the roll&apos;s remaining length.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label>Roll</Label>
            <Select value={rollId} onValueChange={(v) => v && setRollId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a roll…" />
              </SelectTrigger>
              <SelectContent>
                {(rolls.data ?? []).map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.material.manufacturer ? `${r.material.manufacturer} — ` : ""}
                    {r.material.name} · {Number(r.remainingLengthYd).toFixed(1)} yd left
                  </SelectItem>
                ))}
                {(rolls.data ?? []).length === 0 && (
                  <SelectItem value="none" disabled>
                    No rolls on hand — add some in Inventory
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="len">Length (yd)</Label>
              <Input
                id="len"
                type="number"
                step="0.01"
                value={lengthYd}
                onChange={(e) => setLengthYd(e.target.value)}
                placeholder="e.g. 6.5"
                className="tabular-nums"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Kind</Label>
              <Select value={kind} onValueChange={(v) => v && setKind(v as "deduct" | "waste")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deduct">Deduct (used on job)</SelectItem>
                  <SelectItem value="waste">Waste (scrap)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Hood panel"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={deduct.isPending}>
              {deduct.isPending ? "Saving…" : "Deduct"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
