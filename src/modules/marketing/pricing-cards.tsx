import Link from "next/link";
import { ArrowRight, CheckCircle2, Star } from "lucide-react";

import { cn } from "@/lib/utils";
import { PLANS, formatPriceCents, type PlanConfig } from "@/lib/plans";

/**
 * Four-across pricing cards for Free / Solo / Shop / Pro. Enterprise gets
 * its own visual block via <EnterpriseBlock />; deliberately kept out of
 * this component so shops don't misread it as a 5th flat-price tier.
 *
 * Reads pricing + copy from PLANS (src/lib/plans.ts). Never hardcode.
 */
export function PricingCards({
  signupHref = "/signup",
}: {
  signupHref?: string;
}) {
  const displayPlans: PlanConfig[] = [PLANS.free, PLANS.solo, PLANS.shop, PLANS.pro];

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      {displayPlans.map((plan) => {
        const isFree = plan.id === "free";
        const isRecommended = !!plan.recommended;
        const priceLabel =
          plan.monthlyPriceCents === 0
            ? "$0"
            : plan.monthlyPriceCents != null
              ? formatPriceCents(plan.monthlyPriceCents)
              : "";

        return (
          <div
            key={plan.id}
            className={cn(
              "relative flex flex-col rounded-lg border p-6",
              isRecommended
                ? "border-neutral-900 bg-neutral-900 text-neutral-50 shadow-lg dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                : "border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950",
            )}
          >
            {isRecommended && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-400 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-neutral-900">
                <Star className="mr-1 inline h-3 w-3" />
                Most popular
              </span>
            )}
            <h3 className="text-lg font-semibold">{plan.displayName}</h3>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-3xl font-semibold">{priceLabel}</span>
              {plan.monthlyPriceCents != null && plan.monthlyPriceCents > 0 && (
                <span className="text-sm opacity-80">/ month</span>
              )}
              {isFree && <span className="text-sm opacity-80">forever</span>}
            </div>
            <p
              className={cn(
                "mt-2 text-sm",
                isRecommended ? "opacity-90" : "text-neutral-600 dark:text-neutral-400",
              )}
            >
              {plan.tagline}
            </p>
            <ul className="mt-6 flex-1 space-y-2 text-sm">
              {plan.marketingBullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
            <Link
              href={isFree ? signupHref : `${signupHref}?plan=${plan.id}`}
              className={cn(
                "mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium",
                isRecommended
                  ? "bg-neutral-50 text-neutral-900 hover:bg-neutral-200 dark:bg-neutral-900 dark:text-neutral-50 dark:hover:bg-neutral-800"
                  : "bg-neutral-900 text-neutral-50 hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200",
              )}
            >
              {isFree ? "Start free" : `Start with ${plan.displayName}`}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        );
      })}
    </div>
  );
}
