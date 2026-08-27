"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { centsFromDollars, formatMoney } from "@/lib/money";
import { NewCustomerDialog } from "@/modules/crm/new-customer-dialog";
import { NewServiceDialog } from "@/modules/catalog/new-service-dialog";
import { ProductPicker } from "./product-picker";

// Sentinel option value for the "+ New customer" row in the dropdown. Using a
// non-UUID string so it's obviously not a real id if it ever leaks upward.
const NEW_CUSTOMER_SENTINEL = "__new_customer__";

/**
 * Quote builder — pick customer + optional vehicle, add line items either
 * from the service catalog (auto-priced) or as custom rows, tag upsells,
 * set deposit + tax + terms + expiry, then Save.
 */

type LineItem = {
  key: string;
  serviceId: string | null;
  description: string;
  quantity: number;
  unit: "each" | "sqft" | "linear_ft" | "hour";
  unitPriceCents: number;
  discountCents: number;
  taxable: boolean;
  isUpsell: boolean;
  notes?: string;
};

function newLine(overrides: Partial<LineItem> = {}): LineItem {
  return {
    key: crypto.randomUUID(),
    serviceId: null,
    description: "",
    quantity: 1,
    unit: "each",
    unitPriceCents: 0,
    discountCents: 0,
    taxable: true,
    isUpsell: false,
    ...overrides,
  };
}

export function QuoteBuilder({ editingQuoteId }: { editingQuoteId?: string } = {}) {
  const router = useRouter();
  const search = useSearchParams();
  const initialCustomer = search.get("customerId") ?? "";
  const initialVehicle = search.get("vehicleId") ?? "";

  const editingQuote = trpc.quotes.get.useQuery(
    { id: editingQuoteId as string },
    { enabled: Boolean(editingQuoteId) },
  );

  const [customerId, setCustomerId] = useState(initialCustomer);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [newServiceOpen, setNewServiceOpen] = useState(false);
  // Line that opened the "+ New product" dialog — we auto-apply the created
  // product to that line so the user doesn't have to reopen the dropdown.
  const [pendingServiceLineKey, setPendingServiceLineKey] = useState<string | null>(null);
  const [vehicleId, setVehicleId] = useState<string>(initialVehicle);
  const [lines, setLines] = useState<LineItem[]>([newLine()]);
  const [taxRatePct, setTaxRatePct] = useState("");
  const [depositPercent, setDepositPercent] = useState("");
  const [terms, setTerms] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [saveAndSend, setSaveAndSend] = useState(false);
  /**
   * Edit mode only: when true, the save button spawns a NEW quote (with a
   * fresh portal token) instead of mutating the current one in place —
   * useful when the shop has substantively changed the price/scope and
   * wants the customer to re-approve.
   */
  const [requestNewApproval, setRequestNewApproval] = useState(false);
  /**
   * Latches once we've hydrated form state from the fetched quote so we
   * don't fight the user's edits with the loaded data on every render.
   */
  const [hydrated, setHydrated] = useState(false);

  const customers = trpc.customers.list.useQuery({ limit: 100 });
  const vehicles = trpc.vehicles.list.useQuery(
    { customerId: customerId || undefined, limit: 50 },
    { enabled: Boolean(customerId) },
  );
  const services = trpc.services.list.useQuery({ activeOnly: true });

  const create = trpc.quotes.create.useMutation();
  const updateMut = trpc.quotes.update.useMutation();
  const send = trpc.quotes.send.useMutation();
  const utils = trpc.useUtils();

  // Hydrate form state once the edit-target quote arrives. Only runs the
  // first time — subsequent field edits are the source of truth.
  useEffect(() => {
    if (!editingQuoteId || hydrated || !editingQuote.data) return;
    const q = editingQuote.data;
    setCustomerId(q.customerId);
    setVehicleId(q.vehicleId ?? "");
    setTaxRatePct(q.taxRateBps ? (q.taxRateBps / 100).toString() : "");
    setDepositPercent(q.depositPercent ? String(q.depositPercent) : "");
    setTerms(q.terms ?? "");
    setCustomerNotes(q.customerNotes ?? "");
    setInternalNotes(q.internalNotes ?? "");
    setExpiresAt(q.expiresAt ? new Date(q.expiresAt).toISOString().slice(0, 10) : "");
    setLines(
      q.items.map((i) => ({
        key: crypto.randomUUID(),
        serviceId: i.serviceId,
        description: i.description,
        quantity: Number(i.quantity),
        unit: i.unit as LineItem["unit"],
        unitPriceCents: i.unitPriceCents,
        discountCents: i.discountCents,
        taxable: i.taxable,
        isUpsell: i.isUpsell,
        notes: i.notes ?? undefined,
      })),
    );
    // Default the toggle ON if the quote has already been approved — the
    // shop is likely making a substantive change worth re-signing.
    setRequestNewApproval(q.status === "approved");
    setHydrated(true);
  }, [editingQuoteId, hydrated, editingQuote.data]);

  const totals = useMemo(() => computeClientTotals(lines, taxRatePct, depositPercent), [lines, taxRatePct, depositPercent]);

  function updateLine(key: string, patch: Partial<LineItem>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function removeLine(key: string) {
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));
  }
  function addLine(overrides?: Partial<LineItem>) {
    setLines((prev) => [...prev, newLine(overrides)]);
  }

  async function applyService(key: string, serviceId: string) {
    // Fetch the service fresh — don't rely on `services.data` since the
    // "+ New product" flow calls us right after a refetch and the cached
    // snapshot in the closure hasn't been swapped yet on this render.
    const svc =
      services.data?.find((s) => s.id === serviceId) ??
      (await utils.services.list.fetch({ activeOnly: true }).catch(() => null))?.find(
        (s) => s.id === serviceId,
      );
    if (!svc) return;
    // Use the server-side pricing preview so the display matches persistence exactly.
    try {
      const priced = await utils.quotes.priceLine.fetch({ serviceId });
      updateLine(key, {
        serviceId,
        description: svc.name,
        quantity: priced.quantity,
        unit: priced.unit,
        unitPriceCents: priced.unitPriceCents,
        discountCents: priced.discountCents,
        taxable: priced.taxable,
      });
    } catch (err) {
      // e.g. coverage service without default sqft — fall back to bare values.
      updateLine(key, {
        serviceId,
        description: svc.name,
        unitPriceCents: svc.priceCents,
        unit: svc.pricingModel === "coverage" ? "sqft" : svc.pricingModel === "hourly" ? "hour" : "each",
        taxable: svc.taxable,
      });
      toast.info(err instanceof Error ? err.message : "Enter quantity manually");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId) {
      toast.error("Pick a customer first.");
      return;
    }
    if (lines.some((l) => !l.description.trim())) {
      toast.error("Every line needs a description.");
      return;
    }
    const payload = {
      customerId,
      vehicleId: vehicleId || null,
      currency: "USD",
      taxRateBps: taxRatePct ? Math.round(Number(taxRatePct) * 100) : 0,
      depositCents: 0,
      depositPercent: depositPercent ? Number(depositPercent) : 0,
      terms: terms || undefined,
      customerNotes: customerNotes || undefined,
      internalNotes: internalNotes || undefined,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      items: lines.map((l) => ({
        serviceId: l.serviceId,
        materialId: null,
        description: l.description,
        quantity: l.quantity,
        unit: l.unit,
        unitPriceCents: l.unitPriceCents,
        discountCents: l.discountCents,
        taxable: l.taxable,
        isUpsell: l.isUpsell,
        notes: l.notes,
      })),
    };

    try {
      // Three branches:
      //   1. Not editing → always create.
      //   2. Editing + "request new approval" → create a fresh quote (new
      //      portal token, new number, status=draft) so it goes through a
      //      full re-approval cycle. The original quote is left intact.
      //   3. Editing + no re-approval → update in place. The original
      //      portal token still resolves; the customer's approval (if any)
      //      is preserved as a silent tweak.
      let quote: { id: string; number: number };
      if (!editingQuoteId) {
        quote = await create.mutateAsync(payload);
      } else if (requestNewApproval) {
        quote = await create.mutateAsync(payload);
      } else {
        quote = await updateMut.mutateAsync({ id: editingQuoteId, ...payload });
      }

      if (saveAndSend) {
        await send.mutateAsync({ id: quote.id });
        toast.success(
          editingQuoteId && !requestNewApproval
            ? `Quote Q-${quote.number} updated and re-sent.`
            : `Quote Q-${quote.number} ${editingQuoteId ? "created" : "created"} and sent.`,
        );
      } else if (editingQuoteId && !requestNewApproval) {
        toast.success(`Quote Q-${quote.number} updated.`);
      } else {
        toast.success(`Quote Q-${quote.number} saved as draft.`);
      }
      router.push(`/quotes/${quote.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  }

  if (
    customers.isLoading ||
    services.isLoading ||
    (editingQuoteId && !hydrated)
  ) {
    return <Skeleton className="h-64 max-w-6xl mx-auto" />;
  }

  const editingOriginalStatus = editingQuote.data?.status;
  const editingOriginalNumber = editingQuote.data?.number;

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {editingQuoteId
            ? `Edit quote Q-${String(editingOriginalNumber ?? 0).padStart(4, "0")}`
            : "New quote"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {editingQuoteId
            ? "Change line items, pricing, or notes. Toggle re-approval below if the customer needs to sign a fresh version."
            : "Pick a customer + vehicle, add line items (optional upsells), then save as draft or send to the customer's magic-link portal."}
        </p>
      </div>

      {editingQuoteId && (
        <div className="rounded-lg border bg-card p-3">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={requestNewApproval}
              onChange={(e) => setRequestNewApproval(e.target.checked)}
              className="mt-0.5"
            />
            <span className="min-w-0">
              <span className="font-medium">Request new approval</span>
              <span className="ml-2 text-muted-foreground">
                {requestNewApproval
                  ? "Save will create a new quote for the customer to re-approve. The original stays as-is."
                  : "Save updates this quote in place. The customer's existing approval and portal link are preserved."}
              </span>
              {editingOriginalStatus === "approved" && !requestNewApproval && (
                <span className="mt-1 block text-xs text-amber-700 dark:text-amber-300">
                  This quote is already approved — edits will apply silently
                  without prompting the customer.
                </span>
              )}
            </span>
          </label>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Customer</Label>
          <Select
            value={customerId}
            onValueChange={(v) => {
              if (!v) return;
              if (v === NEW_CUSTOMER_SENTINEL) {
                // Open the dialog next tick so the Select's own portal has
                // finished closing before ours mounts (avoids focus fight).
                setTimeout(() => setNewCustomerOpen(true), 0);
                return;
              }
              setCustomerId(v);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose customer…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NEW_CUSTOMER_SENTINEL}>
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <Plus className="h-3.5 w-3.5" /> New customer…
                </span>
              </SelectItem>
              <SelectSeparator />
              {customers.data?.items.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Vehicle (optional)</Label>
          <Select
            value={vehicleId}
            onValueChange={(v) => setVehicleId(v ?? "")}
            disabled={!customerId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose vehicle…" />
            </SelectTrigger>
            <SelectContent>
              {(vehicles.data?.items ?? []).map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {[v.year, v.make, v.model, v.trim].filter(Boolean).join(" ") || v.vin || "vehicle"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-2">
          <h2 className="text-sm font-medium">Line items</h2>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => addLine()}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Add line
          </Button>
        </div>
        <ul>
          {lines.map((line, i) => (
            <li key={line.key} className="border-b last:border-0 p-4">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_100px_90px_120px_120px_auto] md:items-end">
                <div>
                  <Label className="text-xs">Description</Label>
                  <div className="flex gap-2">
                    <ProductPicker
                      className="w-48 shrink-0"
                      value={line.serviceId}
                      items={
                        services.data?.map((s) => ({
                          id: s.id,
                          name: s.name,
                          hint:
                            s.pricingModel === "coverage"
                              ? `${formatMoney(s.priceCents)}/sqft`
                              : s.pricingModel === "hourly"
                                ? `${formatMoney(s.hourlyRateCents ?? 0)}/hr`
                                : formatMoney(s.priceCents),
                        })) ?? []
                      }
                      onChange={(id) => applyService(line.key, id)}
                      onCreateNew={() => {
                        setPendingServiceLineKey(line.key);
                        setNewServiceOpen(true);
                      }}
                    />
                    <Input
                      value={line.description}
                      onChange={(e) => updateLine(line.key, { description: e.target.value })}
                      placeholder="Description shown on the quote"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Qty</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={line.quantity}
                    onChange={(e) => updateLine(line.key, { quantity: Number(e.target.value) || 0 })}
                    className="text-right tabular-nums"
                  />
                </div>
                <div>
                  <Label className="text-xs">Unit</Label>
                  <Select
                    value={line.unit}
                    onValueChange={(v) => v && updateLine(line.key, { unit: v as LineItem["unit"] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="each">each</SelectItem>
                      <SelectItem value="sqft">sqft</SelectItem>
                      <SelectItem value="linear_ft">linear ft</SelectItem>
                      <SelectItem value="hour">hour</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Unit price (USD)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={(line.unitPriceCents / 100).toString()}
                    onChange={(e) =>
                      updateLine(line.key, {
                        unitPriceCents: e.target.value ? centsFromDollars(Number(e.target.value)) : 0,
                      })
                    }
                    className="text-right tabular-nums"
                  />
                </div>
                <div>
                  <Label className="text-xs">Discount (USD)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={(line.discountCents / 100).toString()}
                    onChange={(e) =>
                      updateLine(line.key, {
                        discountCents: e.target.value ? centsFromDollars(Number(e.target.value)) : 0,
                      })
                    }
                    className="text-right tabular-nums"
                  />
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => removeLine(line.key)}
                  disabled={lines.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-2 flex items-center gap-4 text-xs">
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={line.isUpsell}
                    onChange={(e) => updateLine(line.key, { isUpsell: e.target.checked })}
                  />
                  Optional upsell
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={line.taxable}
                    onChange={(e) => updateLine(line.key, { taxable: e.target.checked })}
                  />
                  Taxable
                </label>
                {line.isUpsell && (
                  <Badge variant="outline" className="text-[10px]">
                    Upsell — customer chooses on approval
                  </Badge>
                )}
                <span className="ml-auto font-mono tabular-nums">
                  Line total {formatMoney(Math.max(0, Math.round(line.unitPriceCents * (line.quantity || 1)) - line.discountCents))}
                </span>
              </div>
            </li>
          ))}
        </ul>
        <div className="flex justify-end p-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addLine({ isUpsell: true, description: "Add-on: " })}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Add upsell
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Terms + tax
          </h2>
          <div className="space-y-3">
            <div>
              <Label htmlFor="tax">Tax rate (%)</Label>
              <Input
                id="tax"
                type="number"
                step="0.01"
                value={taxRatePct}
                onChange={(e) => setTaxRatePct(e.target.value)}
                placeholder="8.75"
                className="tabular-nums"
              />
            </div>
            <div>
              <Label htmlFor="deposit">Deposit (%)</Label>
              <Input
                id="deposit"
                type="number"
                min={0}
                max={100}
                value={depositPercent}
                onChange={(e) => setDepositPercent(e.target.value)}
                placeholder="20"
                className="tabular-nums"
              />
            </div>
            <div>
              <Label htmlFor="expiry">Expires on</Label>
              <Input
                id="expiry"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4 md:col-span-2">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Notes
          </h2>
          <div className="space-y-3">
            <div>
              <Label htmlFor="customerNotes">Customer-visible notes</Label>
              <Textarea
                id="customerNotes"
                rows={2}
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="internalNotes">Internal notes (never sent to customer)</Label>
              <Textarea
                id="internalNotes"
                rows={2}
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="terms">Terms</Label>
              <Textarea id="terms" rows={2} value={terms} onChange={(e) => setTerms(e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border bg-card p-4">
        <dl className="space-y-1 text-sm">
          <div className="flex gap-6"><dt className="text-muted-foreground w-24">Subtotal</dt><dd className="font-mono tabular-nums">{formatMoney(totals.subtotalCents)}</dd></div>
          {totals.discountCents > 0 && (
            <div className="flex gap-6"><dt className="text-muted-foreground w-24">Discount</dt><dd className="font-mono tabular-nums">−{formatMoney(totals.discountCents)}</dd></div>
          )}
          <div className="flex gap-6"><dt className="text-muted-foreground w-24">Tax</dt><dd className="font-mono tabular-nums">{formatMoney(totals.taxCents)}</dd></div>
          <div className="flex gap-6 border-t pt-1"><dt className="w-24 font-medium">Total</dt><dd className="font-mono tabular-nums font-medium">{formatMoney(totals.totalCents)}</dd></div>
          {totals.depositCents > 0 && (
            <div className="flex gap-6"><dt className="text-muted-foreground w-24">Deposit due</dt><dd className="font-mono tabular-nums">{formatMoney(totals.depositCents)}</dd></div>
          )}
        </dl>
        <div className="flex items-center gap-2">
          <Button
            type="submit"
            variant="outline"
            onClick={() => setSaveAndSend(false)}
            disabled={create.isPending || updateMut.isPending}
          >
            {(create.isPending || updateMut.isPending) && !saveAndSend ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Saving…
              </>
            ) : editingQuoteId && !requestNewApproval ? (
              "Save changes"
            ) : (
              "Save draft"
            )}
          </Button>
          <Button
            type="submit"
            onClick={() => setSaveAndSend(true)}
            disabled={create.isPending || updateMut.isPending || send.isPending}
          >
            {create.isPending || updateMut.isPending || send.isPending ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Sending…
              </>
            ) : editingQuoteId && !requestNewApproval ? (
              "Save + re-send"
            ) : (
              "Save + send"
            )}
          </Button>
        </div>
      </div>

      <NewCustomerDialog
        open={newCustomerOpen}
        onOpenChange={setNewCustomerOpen}
        onCreated={async (id) => {
          // Re-fetch so the new customer appears in the dropdown, then select it.
          await customers.refetch();
          setCustomerId(id);
        }}
      />

      <NewServiceDialog
        open={newServiceOpen}
        onOpenChange={(v) => {
          setNewServiceOpen(v);
          if (!v) setPendingServiceLineKey(null);
        }}
        onCreated={async (id) => {
          await services.refetch();
          if (pendingServiceLineKey) {
            await applyService(pendingServiceLineKey, id);
            setPendingServiceLineKey(null);
          }
        }}
      />
    </form>
  );
}

// Client-side estimate — server does the authoritative math on save.
function computeClientTotals(lines: LineItem[], taxRatePct: string, depositPercent: string) {
  const nonUpsell = lines.filter((l) => !l.isUpsell);
  const subtotalCents = nonUpsell.reduce((s, l) => s + Math.round(l.unitPriceCents * (l.quantity || 1)), 0);
  const discountCents = nonUpsell.reduce((s, l) => s + l.discountCents, 0);
  const afterDiscount = subtotalCents - discountCents;
  const taxableCents = nonUpsell.filter((l) => l.taxable).reduce(
    (s, l) => s + Math.max(0, Math.round(l.unitPriceCents * (l.quantity || 1)) - l.discountCents),
    0,
  );
  const taxRate = taxRatePct ? Number(taxRatePct) / 100 : 0;
  const taxCents = Math.round(taxableCents * taxRate);
  const totalCents = afterDiscount + taxCents;
  const depositCents = depositPercent
    ? Math.min(totalCents, Math.round(totalCents * (Number(depositPercent) / 100)))
    : 0;
  return { subtotalCents, discountCents, taxCents, totalCents, depositCents };
}
