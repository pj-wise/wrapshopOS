import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { PricingCards } from "@/modules/marketing/pricing-cards";
import { EnterpriseBlock } from "@/modules/marketing/enterprise-block";
import { ComparisonTable } from "@/modules/marketing/comparison-table";

export const metadata: Metadata = {
  title: "Pricing · autoLuxOS",
  description:
    "Free, Solo, Shop, Pro, and multi-location Enterprise pricing for the autoLuxOS shop management platform.",
};

/**
 * Dedicated pricing surface. Reads from PLANS + ENTERPRISE_PRICING_BANDS
 * via the shared marketing components. Also linked from every in-app
 * "Upgrade to X" CTA.
 */
export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <div className="grid h-7 w-7 place-items-center rounded-md bg-neutral-900 text-neutral-50 dark:bg-neutral-100 dark:text-neutral-900">
              aL
            </div>
            <span>autoLuxOS</span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Home
            </Link>
            <Link
              href="/login"
              className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-1 rounded-md bg-neutral-900 px-3 py-1.5 text-neutral-50 hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              Get started <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="mb-10 max-w-3xl">
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-neutral-500">
            Pricing
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Start free. Grow when the shop grows.
          </h1>
          <p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400">
            Unlimited quotes and jobs on every tier — including Free. Paid
            plans add the digital workflow, automation, and integration
            polish that turn a solo operator into a team into a franchise.
          </p>
        </div>

        <PricingCards />

        <div className="mt-16">
          <EnterpriseBlock />
        </div>

        <div className="mt-20">
          <h2 className="mb-6 text-2xl font-semibold tracking-tight">
            Feature comparison
          </h2>
          <ComparisonTable />
        </div>

        <div className="mt-16 rounded-lg border border-neutral-200 bg-neutral-50 p-8 dark:border-neutral-800 dark:bg-neutral-950">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold">Not sure which plan?</h3>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                Start on Free. You can upgrade the moment you want e-signatures,
                Stripe payments, or team features — nothing gets lost.
              </p>
            </div>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-md bg-neutral-900 px-5 py-2.5 text-sm font-medium text-neutral-50 hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              Create your free account
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-neutral-200 py-8 dark:border-neutral-800">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 text-xs text-neutral-500 sm:flex-row">
          <span>
            autoLuxOS — built for wrap, tint, PPF, ceramic, and detailing shops.
          </span>
          <span>&copy; {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
