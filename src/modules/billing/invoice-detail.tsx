"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Copy, ExternalLink, Eye, Mail, RefreshCw, Send } from "lucide-react";

import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/money";
import { InvoiceStatusBadge, QboSyncBadge } from "./invoice-status-badge";
import { RecordPaymentDialog } from "./record-payment-dialog";

export function InvoiceDetail({ id }: { id: string }) {
  const [payOpen, setPayOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const q = trpc.invoices.get.useQuery({ id });
  const markSent = trpc.invoices.markSent.useMutation();
  const resync = trpc.invoices.resyncToQbo.useMutation();
  const resend = trpc.invoices.resend.useMutation();
  const utils = trpc.useUtils();

  if (q.isLoading) return <Skeleton className="mx-auto h-64 max-w-6xl" />;
  if (q.error) return <p className="mx-auto max-w-6xl text-sm text-red-600">{q.error.message}</p>;
  const inv = q.data!;

  async function onCopyPayLink() {
    if (!inv.qboPayLink) return;
    await navigator.clipboard.writeText(inv.qboPayLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast.success("Pay link copied");
  }

  async function onMarkSent() {
    await markSent.mutateAsync({ id });
    await utils.invoices.get.invalidate({ id });
    toast.success("Marked sent.");
  }

  async function onResync() {
    try {
      await resync.mutateAsync({ id });
      await utils.invoices.get.invalidate({ id });
      toast.success("Queued QBO sync.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    }
  }

  async function onResend() {
    try {
      const kind = inv.sentAt ? "resend" : "initial";
      const res = await resend.mutateAsync({ id, kind });
      toast.success(`Emailing ${res.to}…`);
      await utils.invoices.get.invalidate({ id });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Resend failed");
    }
  }

  async function onPreview() {
    try {
      const preview = await utils.invoices.previewEmail.fetch({ id, kind: "resend" });
      const w = window.open("", "_blank", "width=640,height=800");
      if (!w) {
        toast.error("Popup blocked — allow popups for this site to preview.");
        return;
      }
      w.document.write(preview.html);
      w.document.title = preview.subject;
      w.document.close();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Preview failed");
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/invoices"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Invoices
      </Link>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-mono tabular-nums text-2xl font-semibold tracking-tight">
              INV-{String(inv.number).padStart(4, "0")}
            </h1>
            <InvoiceStatusBadge status={inv.status} />
            <QboSyncBadge status={inv.qboSyncStatus} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            <Link href={`/customers/${inv.customer.id}`} className="hover:underline">
              {inv.customer.name}
            </Link>
            {inv.customer.email && ` · ${inv.customer.email}`}
            {inv.job && (
              <>
                {" "}
                ·{" "}
                <Link href={`/jobs/${inv.job.id}`} className="hover:underline">
                  J-{String(inv.job.number).padStart(4, "0")}
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {inv.status === "draft" && (
            <Button variant="outline" size="sm" onClick={onMarkSent}>
              <Send className="mr-1 h-3.5 w-3.5" /> Mark sent
            </Button>
          )}
          {inv.qboSyncStatus !== "syncing" && (
            <Button variant="outline" size="sm" onClick={onResync} disabled={resync.isPending}>
              <RefreshCw className="mr-1 h-3.5 w-3.5" />
              {inv.qboSyncStatus === "synced" ? "Resync" : "Sync to QBO"}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onPreview}>
            <Eye className="mr-1 h-3.5 w-3.5" /> Preview email
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onResend}
            disabled={resend.isPending || !inv.customer.email}
            title={inv.customer.email ? undefined : "Customer has no email on file"}
          >
            <Mail className="mr-1 h-3.5 w-3.5" />
            {inv.sentAt ? "Resend" : "Send"}
          </Button>
          <Button size="sm" onClick={() => setPayOpen(true)} disabled={inv.balanceCents === 0}>
            Record payment
          </Button>
        </div>
      </div>

      {inv.qboSyncError && (
        <div className="mb-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          <strong>QBO sync error:</strong> {inv.qboSyncError}
        </div>
      )}

      {inv.qboPayLink && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border bg-card p-3">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">Customer pay link (QBO)</div>
            <div className="truncate font-mono text-xs">{inv.qboPayLink}</div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={onCopyPayLink}>
              {copied ? "Copied!" : <><Copy className="mr-1 h-3.5 w-3.5" />Copy</>}
            </Button>
            <a
              href={inv.qboPayLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs hover:bg-accent"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open
            </a>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Item</th>
              <th className="px-4 py-2 text-right font-medium">Qty</th>
              <th className="px-4 py-2 text-right font-medium">Unit</th>
              <th className="px-4 py-2 text-right font-medium">Price</th>
              <th className="px-4 py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {inv.items.map((i) => (
              <tr key={i.id}>
                <td className="px-4 py-2">{i.description}</td>
                <td className="px-4 py-2 text-right font-mono tabular-nums">{Number(i.quantity)}</td>
                <td className="px-4 py-2 text-right text-xs text-muted-foreground">{i.unit}</td>
                <td className="px-4 py-2 text-right font-mono tabular-nums">
                  {formatMoney(i.unitPriceCents, inv.currency)}
                </td>
                <td className="px-4 py-2 text-right font-mono tabular-nums">
                  {formatMoney(i.totalCents, inv.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Payments
          </h3>
          {inv.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments recorded.</p>
          ) : (
            <ul className="divide-y text-sm">
              {inv.payments.map((p) => (
                <li key={p.id} className="flex justify-between py-2">
                  <span>
                    <span className="uppercase text-xs text-muted-foreground mr-2">{p.method}</span>
                    {new Date(p.receivedAt).toLocaleDateString()}
                  </span>
                  <span className="font-mono tabular-nums">{formatMoney(p.amountCents, inv.currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border bg-card p-4">
          <dl className="space-y-1 text-sm">
            <Row label="Subtotal" value={formatMoney(inv.subtotalCents, inv.currency)} />
            {inv.discountCents > 0 && (
              <Row label="Discount" value={`−${formatMoney(inv.discountCents, inv.currency)}`} />
            )}
            <Row label="Tax" value={formatMoney(inv.taxCents, inv.currency)} />
            <Row label="Total" value={formatMoney(inv.totalCents, inv.currency)} bold />
            <Row label="Amount paid" value={formatMoney(inv.amountPaidCents, inv.currency)} />
            <Row label="Balance" value={formatMoney(inv.balanceCents, inv.currency)} bold />
          </dl>
        </div>
      </div>

      <RecordPaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        invoiceId={id}
        maxAmountCents={inv.balanceCents}
        currency={inv.currency}
        onDone={async () => {
          await utils.invoices.get.invalidate({ id });
          await utils.invoices.list.invalidate();
        }}
      />
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between gap-6 ${bold ? "font-medium" : ""}`}>
      <dt className={bold ? "" : "text-muted-foreground"}>{label}</dt>
      <dd className="font-mono tabular-nums">{value}</dd>
    </div>
  );
}
