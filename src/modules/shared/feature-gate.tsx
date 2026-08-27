"use client";

import { type ReactNode, useState } from "react";
import { Sparkles, Lock, Wrench, Star, Info } from "lucide-react";

import type { FeatureKey } from "@/lib/features";
import { getFeature } from "@/lib/features";
import { useFeature } from "@/hooks/use-features";
import { cn } from "@/lib/utils";
import type { ResolvedFeature } from "@/server/features/service";

// ---------------------------------------------------------------------------
// <FeatureGate>
// ---------------------------------------------------------------------------

type FeatureGateProps = {
  feature: FeatureKey;
  children: ReactNode;
  /**
   * How to render when the feature is unavailable:
   *  - "hide" (default): render nothing
   *  - "tooltip": render children wrapped so hover explains, click opens dialog
   *  - "badge": render children with a badge overlay
   *  - "disabled": render children with pointer-events-none + reduced opacity
   *  - a ReactNode: render that fallback
   */
  fallback?: "hide" | "tooltip" | "badge" | "disabled" | ReactNode;
};

export function FeatureGate({ feature, children, fallback = "hide" }: FeatureGateProps) {
  const resolved = useFeature(feature);
  const available = resolved.state === "enabled" || resolved.state === "beta";
  if (available) return <>{children}</>;

  if (fallback === "hide") return null;
  if (fallback === "tooltip") return <FeatureTooltip feature={feature}>{children}</FeatureTooltip>;
  if (fallback === "badge") {
    return (
      <div className="relative inline-block">
        <div className="pointer-events-none opacity-60">{children}</div>
        <div className="absolute -top-2 -right-2">
          <FeatureBadge state={resolved.state} />
        </div>
      </div>
    );
  }
  if (fallback === "disabled") {
    return <div className="pointer-events-none opacity-50">{children}</div>;
  }
  return <>{fallback}</>;
}

// ---------------------------------------------------------------------------
// <FeatureBadge>
// ---------------------------------------------------------------------------

const BADGE_STYLES: Record<ResolvedFeature["state"], { label: string; className: string; icon: typeof Sparkles }> = {
  enabled: { label: "Enabled", className: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100", icon: Sparkles },
  beta: { label: "Beta", className: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100", icon: Sparkles },
  coming_soon: { label: "Coming Soon", className: "bg-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200", icon: Star },
  requires_integration: { label: "Setup Needed", className: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100", icon: Wrench },
  requires_subscription: { label: "Pro", className: "bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-100", icon: Lock },
  disabled: { label: "Disabled", className: "bg-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200", icon: Info },
  unavailable: { label: "Unavailable", className: "bg-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200", icon: Info },
};

export function FeatureBadge({
  state,
  className,
}: {
  state: ResolvedFeature["state"];
  className?: string;
}) {
  const style = BADGE_STYLES[state];
  const Icon = style.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        style.className,
        className,
      )}
    >
      <Icon className="h-2.5 w-2.5" />
      {style.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// <FeatureTooltip> — wraps children; hover shows why, click opens dialog.
// ---------------------------------------------------------------------------

export function FeatureTooltip({ feature, children }: { feature: FeatureKey; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const def = getFeature(feature);
  const resolved = useFeature(feature);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative inline-flex items-center"
        title={`${def.name} — ${def.description}`}
      >
        <div className="pointer-events-none opacity-60 group-hover:opacity-80">{children}</div>
        <FeatureBadge state={resolved.state} className="ml-2" />
      </button>
      {open && (
        <FeatureUnavailableDialog
          feature={feature}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// <FeatureUnavailableDialog>
// ---------------------------------------------------------------------------

export function FeatureUnavailableDialog({
  feature,
  onClose,
}: {
  feature: FeatureKey;
  onClose: () => void;
}) {
  const def = getFeature(feature);
  const resolved = useFeature(feature);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-lg border border-neutral-200 bg-white p-6 shadow-xl dark:border-neutral-800 dark:bg-neutral-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{def.name}</h2>
          <FeatureBadge state={resolved.state} />
        </div>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">{def.description}</p>
        {def.upgradeCopy && (
          <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-500">{def.upgradeCopy}</p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
