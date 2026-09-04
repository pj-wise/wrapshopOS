import type { Metadata } from "next";

import { InAppPricingCalculator } from "@/modules/pricing-calculator/components/in-app-pricing-calculator";

export const metadata: Metadata = {
  title: "Pricing Calculator · autoLuxOS",
};

/**
 * In-app calculator surface. Same core UI as the public /calculator page
 * but with save-as-quote, recent estimates, and Shop-tier analytics.
 */
export default function InAppCalculatorPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Pricing Calculator
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Estimate a wrap, tint, or PPF job. Save promising estimates as draft
          quotes for follow-up.
        </p>
      </div>

      <InAppPricingCalculator />
    </div>
  );
}
