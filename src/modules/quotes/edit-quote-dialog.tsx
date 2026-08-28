"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QuoteBuilder } from "./quote-builder";

/**
 * Modal wrapper around <QuoteBuilder editingQuoteId=... />. Used when
 * clicking a job/quote card from a list view (production board, calendar,
 * quote detail) so the shop can edit line items + terms without losing
 * their place on the current page.
 *
 * The builder's own submit already toasts and invalidates the relevant
 * caches; we just close the dialog via the `onSaved` callback.
 */
export function EditQuoteDialog({
  open,
  onOpenChange,
  quoteId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteId: string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Edit quote</DialogTitle>
          <DialogDescription>
            Adjust line items, pricing, or notes. Toggle re-approval if the
            customer needs to sign a new version.
          </DialogDescription>
        </DialogHeader>
        <div className="-mx-4 min-h-0 flex-1 overflow-y-auto px-4">
          {quoteId && (
            <QuoteBuilder
              editingQuoteId={quoteId}
              onSaved={() => onOpenChange(false)}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
