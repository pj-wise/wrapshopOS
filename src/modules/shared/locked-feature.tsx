"use client";

import { type ReactNode, useState } from "react";
import { Lock } from "lucide-react";

import type { FeatureKey } from "@/lib/features";
import { useFeature } from "@/hooks/use-features";
import { cn } from "@/lib/utils";

import { FeatureUnavailableDialog } from "./feature-gate";

/**
 * Contextual lock wrapper. Renders children when the feature is enabled;
 * when locked, renders a dimmed/click-intercepted version with a lock icon
 * that opens the upgrade dialog on click.
 *
 * Use this to surface premium affordances rather than hiding them entirely
 * — the shop sees where the value is even when they can't use it yet.
 *
 * Example:
 *   <LockedFeature feature="payments.stripe">
 *     <Button>Collect with Stripe</Button>
 *   </LockedFeature>
 */
export function LockedFeature({
  feature,
  children,
  className,
}: {
  feature: FeatureKey;
  children: ReactNode;
  className?: string;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const resolved = useFeature(feature);

  const isUsable = resolved.state === "enabled" || resolved.state === "beta";
  if (isUsable) {
    // Feature is available for this org — render children unmodified.
    return <>{children}</>;
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setDialogOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setDialogOpen(true);
          }
        }}
        className={cn(
          "group relative inline-block cursor-pointer",
          className,
        )}
        aria-label={`Locked: ${feature}`}
      >
        <div
          className="pointer-events-none opacity-50 grayscale transition-opacity group-hover:opacity-60"
          aria-hidden
        >
          {children}
        </div>
        <span className="absolute -top-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-neutral-900 text-neutral-50 shadow-md dark:bg-neutral-100 dark:text-neutral-900">
          <Lock className="h-3 w-3" />
        </span>
      </div>
      {dialogOpen && (
        <FeatureUnavailableDialog
          feature={feature}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </>
  );
}
