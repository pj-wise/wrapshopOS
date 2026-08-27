"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Copy, ExternalLink, Send, X } from "lucide-react";

import { trpc } from "@/lib/trpc/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/money";
import { QuoteStatusBadge } from "./quote-status-badge";

export function QuoteDetail({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const q = trpc.quotes.get.useQuery({ id });
  const send = trpc.quotes.send.useMutation();
  const duplicate = trpc.quotes.duplicate.useMutation();
  const voidMutation = trpc.quotes.void.useMutation();
  const utils = trpc.useUtils();

  if (q.isLoading) return <Skeleton className="h-64 max-w-6xl mx-auto" />;
  if (q.error) return <p className="mx-auto max-w-6xl text-sm text-red-600">{q.error.message}</p>;
  const quote = q.data!;

  const portalUrl = typeof window !== "undefined" ? `${window.location.origin}/q/${quote.portalToken}` : "";

  async function copyPortalLink() {
    await navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast.success("Portal link copied");
  }

  async function onSend() {
    try {
      await send.mutateAsync({ id: quote.id });
      toast.success("Quote sent.");
      await utils.quotes.get.invalidate({ id });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Send failed");
    }
  }

  async function onDuplicate() {
    try {
      const dup = await duplicate.mutateAsync({ id: quote.id });
      toast.success(`Duplicated as Q-${dup.number}.`);
      window.location.href = `/quotes/${dup.id}`;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Duplicate failed");
    }
  }

  async function onVoid() {
    if (!confirm("Void this quote? It will be removed from active quotes.")) return;
    try {
      await voidMutation.mutateAsync({ id: quote.id });
      toast.success("Quote voided.");
      await utils.quotes.get.invalidate({ id });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Void failed");
    }
  }

  const nonUpsell = quote.items.filter((i) => !i.isUpsell);
  const upsells = quote.items.filter((i) => i.isUpsell);

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/quotes"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Quotes
      </Link>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight font-mono tabular-nums">
              Q-{String(quote.number).padStart(4, "0")}
            </h1>
            <QuoteStatusBadge status={quote.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            <Link href={`/customers/${quote.customer.id}`} className="hover:underline">
              {quote.customer.name}
            </Link>
            {quote.customer.email && ` · ${quote.customer.email}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {quote.status !== "revoked" && (
            <Link
              href={`/quotes/${quote.id}/edit`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Edit
            </Link>
          )}
          <Button variant="outline" size="sm" onClick={onDuplicate} disabled={duplicate.isPending}>
            <Copy className="mr-1 h-3.5 w-3.5" />
            Duplicate
          </Button>
          {quote.status !== "revoked" && quote.status !== "approved" && (
            <Button variant="outline" size="sm" onClick={onVoid} disabled={voidMutation.isPending}>
              <X className="mr-1 h-3.5 w-3.5" />
              Void
            </Button>
          )}
          {quote.status === "draft" && (
            <Button size="sm" onClick={onSend} disabled={send.isPending}>
              <Send className="mr-1 h-3.5 w-3.5" />
              {send.isPending ? "Sending…" : "Send to customer"}
            </Button>
          )}
        </div>
      </div>

      {quote.status !== "draft" && quote.status !== "revoked" && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border bg-card p-3 text-sm">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">Portal link</div>
            <div className="truncate font-mono text-xs">{portalUrl}</div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={copyPortalLink}>
              {copied ? "Copied!" : "Copy"}
            </Button>
            <a
              href={portalUrl}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <ExternalLink className="mr-1 h-3.5 w-3.5" /> Open
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
            {nonUpsell.map((i) => (
              <tr key={i.id}>
                <td className="px-4 py-2">{i.description}</td>
                <td className="px-4 py-2 text-right font-mono tabular-nums">{Number(i.quantity)}</td>
                <td className="px-4 py-2 text-right text-xs text-muted-foreground">{i.unit}</td>
                <td className="px-4 py-2 text-right font-mono tabular-nums">
                  {formatMoney(i.unitPriceCents)}
                </td>
                <td className="px-4 py-2 text-right font-mono tabular-nums">
                  {formatMoney(i.totalCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {upsells.length > 0 && (
          <>
            <div className="border-t bg-muted/20 px-4 py-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Optional upsells
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y">
                {upsells.map((i) => (
                  <tr key={i.id}>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span>{i.description}</span>
                        {i.upsellAccepted === true && (
                          <Badge className="bg-emerald-100 text-emerald-900 text-[10px] dark:bg-emerald-900/40 dark:text-emerald-100">
                            accepted
                          </Badge>
                        )}
                        {i.upsellAccepted === false && (
                          <Badge variant="outline" className="text-[10px]">declined</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums">{Number(i.quantity)}</td>
                    <td className="px-4 py-2 text-right text-xs text-muted-foreground">{i.unit}</td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums">
                      {formatMoney(i.unitPriceCents)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums">
                      +{formatMoney(i.totalCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      <div className="mt-4 flex justify-end">
        <dl className="min-w-[280px] space-y-1 rounded-lg border bg-card p-4 text-sm">
          <Row label="Subtotal" value={formatMoney(quote.subtotalCents)} />
          {quote.discountCents > 0 && <Row label="Discount" value={`−${formatMoney(quote.discountCents)}`} />}
          <Row label="Tax" value={formatMoney(quote.taxCents)} />
          <Row label="Total" value={formatMoney(quote.totalCents)} bold />
          {quote.depositCents > 0 && <Row label="Deposit due" value={formatMoney(quote.depositCents)} />}
        </dl>
      </div>

      {quote.customerNotes && (
        <div className="mt-4 rounded-lg border bg-card p-4">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">Notes to customer</h3>
          <p className="text-sm whitespace-pre-wrap">{quote.customerNotes}</p>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between gap-8 ${bold ? "font-medium" : ""}`}>
      <dt className={bold ? "" : "text-muted-foreground"}>{label}</dt>
      <dd className="font-mono tabular-nums">{value}</dd>
    </div>
  );
}
