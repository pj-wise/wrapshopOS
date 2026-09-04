import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";

import { PricingCalculator } from "@/modules/pricing-calculator/components/pricing-calculator";

export const metadata: Metadata = {
  title: "Pricing Calculator · autoLuxOS",
  description:
    "Free wrap, tint, and PPF pricing calculator. Estimate material, labor, overhead, and suggested price in seconds. No sign-up required.",
};

/**
 * Public, unauthenticated calculator surface. Standalone — anyone can hit
 * this URL and get a real estimate. "Sign up to save" CTA is the conversion
 * hook into the in-app version.
 */
export default function CalculatorPage() {
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
          <nav className="hidden items-center gap-6 text-sm md:flex">
            <Link
              href="/#features"
              className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
            >
              Features
            </Link>
            <Link
              href="/pricing"
              className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
            >
              Pricing
            </Link>
            <span className="font-medium text-neutral-900 dark:text-neutral-100">
              Calculator
            </span>
          </nav>
          <div className="flex items-center gap-4 text-sm">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Home
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

      <main className="mx-auto w-full max-w-6xl px-6 py-12">
        <div className="mb-8 max-w-3xl">
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-neutral-500">
            Pricing calculator
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Estimate a wrap, tint, or PPF job in seconds.
          </h1>
          <p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400">
            Pick a vehicle (optional), select material, and tune margin. Numbers
            update in real time. No sign-up required.
          </p>
        </div>

        <PricingCalculator
          actions={
            <div className="space-y-3">
              <div className="flex items-start gap-2 text-sm">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" />
                <p className="text-neutral-600 dark:text-neutral-400">
                  Sign up free to <strong>save this estimate</strong>, sync to
                  your customer + vehicle records, and turn it into a real quote.
                </p>
              </div>
              <Link
                href="/signup"
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-50 hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
              >
                Create your free account
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          }
        />
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
