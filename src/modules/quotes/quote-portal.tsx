"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, CheckCircle2, X } from "lucide-react";

import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/money";
import { QuoteStatusBadge } from "./quote-status-badge";

/**
 * Customer-facing quote portal. Renders on a public route reached via
 * `/q/<opaque-token>` — no login required. Actions: approve (typed-name +
 * terms acceptance = basic e-sign), decline (optional reason).
 */
export function QuotePortal({ token }: { token: string }) {
  const q = trpc.portal.getQuote.useQuery({ token });
  const decide = trpc.portal.decideQuote.useMutation();
  const utils = trpc.useUtils();

  const [signatureName, setSignatureName] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedUpsells, setAcceptedUpsells] = useState<Set<string>>(new Set());
  const [declineReason, setDeclineReason] = useState("");
  const [mode, setMode] = useState<"idle" | "approve" | "decline">("idle");

  if (q.isLoading) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="h-40 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }
  if (q.error) {
    return (
      <div className="mx-auto max-w-3xl p-6 text-center">
        <h1 className="text-2xl font-semibold">Quote unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">{q.error.message}</p>
      </div>
    );
  }
  const quote = q.data!;
  const nonUpsell = quote.items.filter((i) => !i.isUpsell);
  const upsells = quote.items.filter((i) => i.isUpsell);
  const decided = quote.status === "approved" || quote.status === "declined";

  const optionalTotal = upsells
    .filter((u) => acceptedUpsells.has(u.id))
    .reduce((s, u) => s + u.totalCents, 0);

  async function approve() {
    if (!signatureName.trim()) {
      toast.error("Type your full name to sign.");
      return;
    }
    if (!acceptedTerms) {
      toast.error("Please accept the terms.");
      return;
    }
    try {
      await decide.mutateAsync({
        token,
        action: "approve",
        signatureName,
        acceptedTerms: true,
        acceptedUpsells: Array.from(acceptedUpsells),
      });
      toast.success("Quote approved. The shop will be in touch.");
      await utils.portal.getQuote.invalidate({ token });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function decline() {
    try {
      await decide.mutateAsync({
        token,
        action: "decline",
        declinedReason: declineReason || undefined,
        acceptedTerms: false,
        acceptedUpsells: [],
      });
      toast.success("Quote declined.");
      await utils.portal.getQuote.invalidate({ token });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Shop header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-neutral-900 text-neutral-50 dark:bg-neutral-100 dark:text-neutral-900">
            {quote.organization.name.slice(0, 1)}
          </div>
          <div className="text-sm font-medium">{quote.organization.name}</div>
        </div>
        <QuoteStatusBadge status={quote.status} />
      </div>

      <div className="rounded-lg border bg-card p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Quote</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight font-mono tabular-nums">
              Q-{String(quote.number).padStart(4, "0")}
            </h1>
            <div className="mt-1 text-sm text-muted-foreground">
              For {quote.customer.name}
            </div>
          </div>
          <div className="text-right text-sm">
            <div className="font-mono tabular-nums text-2xl font-semibold">
              {formatMoney(quote.totalCents + optionalTotal, quote.currency)}
            </div>
            {quote.expiresAt && (
              <div className="mt-1 text-xs text-muted-foreground">
                Expires {new Date(quote.expiresAt).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>

        <ul className="divide-y">
          {nonUpsell.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <div className="text-sm">{i.description}</div>
                {Number(i.quantity) !== 1 && (
                  <div className="text-xs text-muted-foreground">
                    {Number(i.quantity)} {i.unit} × {formatMoney(i.unitPriceCents)}
                  </div>
                )}
              </div>
              <div className="shrink-0 font-mono tabular-nums text-sm">
                {formatMoney(i.totalCents)}
              </div>
            </li>
          ))}
        </ul>

        {upsells.length > 0 && (
          <div className="mt-6 rounded-lg border bg-muted/30 p-4">
            <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Recommended add-ons
            </h2>
            <ul className="space-y-2">
              {upsells.map((u) => {
                const chosen = acceptedUpsells.has(u.id);
                const persistedDecision = u.upsellAccepted;
                return (
                  <li
                    key={u.id}
                    className="flex items-center justify-between gap-4 rounded-md border bg-card p-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{u.description}</div>
                      <div className="text-xs text-muted-foreground">
                        +{formatMoney(u.totalCents)}
                      </div>
                    </div>
                    {decided ? (
                      persistedDecision ? (
                        <span className="text-xs text-emerald-700 dark:text-emerald-300">accepted</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">declined</span>
                      )
                    ) : (
                      <Button
                        size="sm"
                        variant={chosen ? "default" : "outline"}
                        onClick={() => {
                          const next = new Set(acceptedUpsells);
                          if (chosen) next.delete(u.id);
                          else next.add(u.id);
                          setAcceptedUpsells(next);
                        }}
                      >
                        {chosen ? (
                          <>
                            <Check className="mr-1 h-3.5 w-3.5" /> Added
                          </>
                        ) : (
                          "Add"
                        )}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <dl className="min-w-[240px] space-y-1 text-sm">
            <Row label="Subtotal" value={formatMoney(quote.subtotalCents)} />
            {quote.discountCents > 0 && (
              <Row label="Discount" value={`−${formatMoney(quote.discountCents)}`} />
            )}
            <Row label="Tax" value={formatMoney(quote.taxCents)} />
            {optionalTotal > 0 && (
              <Row label="Add-ons" value={`+${formatMoney(optionalTotal)}`} />
            )}
            <Row label="Total" value={formatMoney(quote.totalCents + optionalTotal)} bold />
            {quote.depositCents > 0 && (
              <Row label="Deposit due" value={formatMoney(quote.depositCents)} />
            )}
          </dl>
        </div>

        {quote.customerNotes && (
          <div className="mt-6 rounded-md bg-muted/40 p-4">
            <h3 className="mb-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              From the shop
            </h3>
            <p className="text-sm whitespace-pre-wrap">{quote.customerNotes}</p>
          </div>
        )}

        {quote.terms && (
          <div className="mt-6 rounded-md border p-4">
            <h3 className="mb-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Terms
            </h3>
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">{quote.terms}</p>
          </div>
        )}
      </div>

      {decided ? (
        <div className="mt-6 rounded-lg border bg-card p-6 text-center">
          {quote.status === "approved" ? (
            <>
              <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-600" />
              <h2 className="text-lg font-semibold">Approved</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Signed by <strong>{quote.signatureName}</strong> on{" "}
                {quote.approvedAt && new Date(quote.approvedAt).toLocaleString()}.
              </p>
            </>
          ) : (
            <>
              <X className="mx-auto mb-2 h-8 w-8 text-red-600" />
              <h2 className="text-lg font-semibold">Declined</h2>
              {quote.declinedReason && (
                <p className="mt-1 text-sm text-muted-foreground">
                  Reason: {quote.declinedReason}
                </p>
              )}
            </>
          )}
        </div>
      ) : mode === "idle" ? (
        <div className="mt-6 flex gap-2">
          <Button className="flex-1" size="lg" onClick={() => setMode("approve")}>
            Approve & sign
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => setMode("decline")}
          >
            Decline
          </Button>
        </div>
      ) : mode === "approve" ? (
        <div className="mt-6 rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold">Approve quote</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Type your full name to sign electronically. This records your name, IP address,
            and the timestamp.
          </p>
          <div className="mt-4 space-y-3">
            <div>
              <Label htmlFor="signatureName">Full name</Label>
              <Input
                id="signatureName"
                value={signatureName}
                onChange={(e) => setSignatureName(e.target.value)}
                placeholder="Marcus Chen"
                autoFocus
              />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                I agree to the terms above and authorize the shop to begin work on this quote.
              </span>
            </label>
          </div>
          <div className="mt-6 flex gap-2">
            <Button variant="outline" onClick={() => setMode("idle")}>
              Back
            </Button>
            <Button className="flex-1" onClick={approve} disabled={decide.isPending}>
              {decide.isPending ? "Signing…" : "Sign & approve"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold">Decline quote</h2>
          <div className="mt-4 space-y-3">
            <div>
              <Label htmlFor="declineReason">Reason (optional)</Label>
              <Textarea
                id="declineReason"
                rows={3}
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="Anything the shop should know?"
              />
            </div>
          </div>
          <div className="mt-6 flex gap-2">
            <Button variant="outline" onClick={() => setMode("idle")}>
              Back
            </Button>
            <Button variant="destructive" className="flex-1" onClick={decline} disabled={decide.isPending}>
              {decide.isPending ? "Declining…" : "Decline"}
            </Button>
          </div>
        </div>
      )}
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
