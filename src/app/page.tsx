import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Calendar,
  Car,
  FileText,
  Inbox,
  Package,
  Receipt,
  Sparkles,
  Wrench,
} from "lucide-react";

import { PricingCards } from "@/modules/marketing/pricing-cards";
import { EnterpriseBlock } from "@/modules/marketing/enterprise-block";

const FEATURES = [
  {
    icon: FileText,
    title: "Quotes that respect material math",
    body: "Coverage-based pricing, vehicle-size matrices, upsells, magic-link approval with typed e-sign. Optional add-ons the customer picks on approval.",
  },
  {
    icon: Wrench,
    title: "Production Kanban for a shop floor",
    body: "Drag jobs across the pipeline. Checklists per service, photo phases (before / during / after / delivery / damage / QC), clock in/out per job.",
  },
  {
    icon: Car,
    title: "Vehicle-centered history",
    body: "VIN decode + plate search, every install / warranty / photo tied to the vehicle. Search by VIN or plate in ⌘K.",
  },
  {
    icon: Calendar,
    title: "Bay + tech scheduling",
    body: "Day + week views with capacity per bay, conflict detection at write time. Techs see their jobs on their phone.",
  },
  {
    icon: Package,
    title: "Real roll inventory",
    body: 'Track 60" Satin Black roll by remaining yd + cost/ft. Deduct against jobs at checklist time. Material profitability report.',
  },
  {
    icon: Inbox,
    title: "One inbox for the shop",
    body: "Email threads, templates with mustache-safe interpolation, delivery status tracking. SMS via Twilio.",
  },
  {
    icon: Receipt,
    title: "Stripe + QuickBooks, decoupled",
    body: "Collect deposits + balances via Stripe. Sync the ledger to QuickBooks Online. Use one, both, or neither — pick per shop.",
  },
  {
    icon: BarChart3,
    title: "Real profitability",
    body: "Revenue by month, service mix, tech hours, material spend. Every stat backs to underlying data — no smoke and mirrors.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 font-semibold tracking-tight">
            <div className="grid h-7 w-7 place-items-center rounded-md bg-neutral-900 text-neutral-50 dark:bg-neutral-100 dark:text-neutral-900">
              aL
            </div>
            <span>autoLuxOS</span>
          </div>
          <nav className="hidden items-center gap-6 text-sm md:flex">
            <a
              href="#features"
              className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
            >
              Features
            </a>
            <Link
              href="/pricing"
              className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
            >
              Pricing
            </Link>
          </nav>
          <div className="flex items-center gap-4 text-sm">
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

      {/* Hero */}
      <section className="mx-auto flex w-full max-w-6xl flex-col px-6 pt-20 pb-16">
        <div className="max-w-3xl">
          <p className="mb-4 text-xs font-medium uppercase tracking-widest text-neutral-500">
            For wrap · tint · PPF · ceramic · detailing shops
          </p>
          <h1 className="text-5xl font-semibold leading-tight tracking-tight sm:text-6xl">
            Run your whole restyling shop from one place.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-neutral-600 dark:text-neutral-400">
            Leads to invoices, with a production Kanban, real material tracking,
            magic-link customer portal, and Stripe + QuickBooks integrations.
            Built by people who&apos;ve spent time in a wrap bay.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-md bg-neutral-900 px-5 py-3 text-neutral-50 hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              Start free <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/pricing"
              className="rounded-md border border-neutral-300 px-5 py-3 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              See pricing
            </Link>
          </div>
          <p className="mt-6 text-xs text-neutral-500">
            Unlimited quotes and jobs — even on Free · No per-seat pricing on
            paid plans · Cancel any time
          </p>
        </div>
      </section>

      {/* Features grid */}
      <section
        id="features"
        className="border-t border-neutral-200 py-16 dark:border-neutral-800"
      >
        <div className="mx-auto max-w-6xl px-6">
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-neutral-500">
            Features
          </p>
          <h2 className="text-3xl font-semibold tracking-tight">
            Everything the shop actually needs.
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950"
                >
                  <Icon className="mb-3 h-5 w-5 text-neutral-500" />
                  <h3 className="text-sm font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-sm text-neutral-600 dark:text-neutral-400">
                    {f.body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing preview (four cards + link to full comparison) */}
      <section
        id="pricing"
        className="border-t border-neutral-200 py-16 dark:border-neutral-800"
      >
        <div className="mx-auto max-w-6xl px-6">
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-neutral-500">
            Pricing
          </p>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-3xl font-semibold tracking-tight">
              Simple. Grows with your shop.
            </h2>
            <p className="max-w-md text-sm text-neutral-600 dark:text-neutral-400">
              Upgrade for better workflows, not arbitrary job limits. Free is
              genuinely free forever.
            </p>
          </div>
          <div className="mt-10">
            <PricingCards />
          </div>
          <div className="mt-10">
            <EnterpriseBlock />
          </div>
          <div className="mt-8 text-center">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 text-sm font-medium text-neutral-900 hover:underline dark:text-neutral-100"
            >
              See full feature comparison
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Positioning strip */}
      <section className="border-t border-neutral-200 bg-neutral-50 py-12 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 sm:grid-cols-3">
          {[
            {
              icon: Sparkles,
              title: "Unlimited quotes and jobs — even on Free",
              body: "Free is limited by convenience features (e-sign, payments, storage), not by arbitrary business-volume caps.",
            },
            {
              icon: Sparkles,
              title: "No per-seat pricing on paid plans",
              body: "Add every installer, front-desk person, and admin to Solo/Shop/Pro at no extra cost.",
            },
            {
              icon: Sparkles,
              title: "Stripe + QuickBooks decoupled",
              body: "Collect payments through Stripe. Sync accounting through QuickBooks. Use either or both.",
            },
          ].map((strip) => {
            const Icon = strip.icon;
            return (
              <div key={strip.title} className="flex items-start gap-3">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-neutral-500" />
                <div>
                  <h3 className="text-sm font-semibold">{strip.title}</h3>
                  <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                    {strip.body}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

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
