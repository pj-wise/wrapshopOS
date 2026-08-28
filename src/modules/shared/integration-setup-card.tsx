import Link from "next/link";
import { ArrowRight, PlugZap } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

/**
 * Placeholder shown wherever a feature needs a per-tenant integration
 * connected before it becomes usable. Rendered inline (e.g. the inbox
 * composer when SMS isn't wired) or as a full-cell fallback.
 *
 * Not a `<FeatureGate>` fallback — it's a component the caller mounts
 * *inside* the gate branch when they want a richer prompt than a badge.
 */
export function IntegrationSetupCard({
  title,
  description,
  href = "/admin/integrations",
  compact = false,
  className,
}: {
  title: string;
  description?: string;
  /** Where the Configure button routes. Defaults to admin integrations. */
  href?: string;
  /** Slim vertical variant for tight spaces (inline in a composer, sidebar). */
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-2 rounded-lg border border-dashed bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between",
        compact && "gap-1.5 p-3",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
          <PlugZap className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium">{title}</div>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      <Link
        href={href}
        className={cn(buttonVariants({ size: "sm" }), "shrink-0")}
      >
        Configure
        <ArrowRight className="ml-1 h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
