import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Calendar,
  Car,
  CheckCircle2,
  FileText,
  Inbox,
  Package,
  Receipt,
  Wrench,
} from "lucide-react";

const FEATURES = [
  {
    icon: FileText,
    title: "Quotes that respect material math",
    body: "Coverage-based pricing, vehicle-size matrices, upsells, magic-link approval with typed e-sign. Optional add-ons the customer picks on approval.",
  },
  {
    icon: Wrench,
    title: "Production Kanban built for a shop floor",
    body: "Drag jobs from Backlog → Delivered. Checklists per service, photo phases (before / during / after / delivery / damage / QC), clock in/out per job.",
  },
  {
    icon: Car,
    title: "Vehicle-centered history",
    body: "NHTSA VIN decode, plate + trigram search, every install / warranty / photo tied to the vehicle. Search by VIN or plate in ⌘K.",
  },
  {
    icon: Calendar,
    title: "Bay + tech scheduling",
    body: "Day + week views with capacity per bay, conflict detection at write time. Techs see their jobs on their phone.",
  },
  {
    icon: Package,
    title: "Real roll inventory",
    body: "Track 60″ Satin Black roll by remaining yd + cost/ft. Deduct against jobs at checklist time. Material profitability report.",
  },
  {
    icon: Inbox,
    title: "One inbox for the shop",
    body: "Email threads, templates with mustache-safe interpolation, delivery status tracking. SMS pluggable via provider interface.",
  },
  {
    icon: Receipt,
    title: "QuickBooks-first billing",
    body: "OAuth to QuickBooks Online, auto-sync invoices with QuickBooks-hosted payment links. Webhook reconciliation keeps balances in sync.",
  },
  {
    icon: BarChart3,
    title: "Real profitability",
    body: "Revenue by month, service mix, tech hours, material spend. Every stat backs to underlying data — no smoke and mirrors.",
  },
];

const TIERS = [
  {
    name: "Starter",
    price: "$0",
    period: "forever",
    tag: "Everything you need to run day-to-day.",
    perks: [
      "Unlimited customers, vehicles, quotes, jobs",
      "Free NHTSA VIN decode",
      "1 location",
      "Basic e-signature",
      "Quote portal + email delivery",
    ],
    cta: "Start free",
    href: "/signup",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$49",
    period: "per month",
    tag: "For established shops with multiple techs.",
    perks: [
      "Everything in Starter",
      "Multiple locations + bays",
      "Advanced automation triggers",
      "Advanced reporting (cohorts, LTV)",
      "AI assistant (Anthropic / OpenAI)",
      "Priority support",
    ],
    cta: "Start Pro trial",
    href: "/signup?plan=pro",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Talk to us",
    period: "",
    tag: "3D visualizer + PPF pattern integration.",
    perks: [
      "Everything in Pro",
      "3D vehicle visualizer",
      "PPF pattern-provider integration",
      "Custom SSO",
      "Volume + fleet discounts",
      "Dedicated onboarding",
    ],
    cta: "Contact sales",
    href: "mailto:hello@wrapshop.os",
    highlighted: false,
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 font-semibold tracking-tight">
            <div className="grid h-7 w-7 place-items-center rounded-md bg-neutral-900 text-neutral-50 dark:bg-neutral-100 dark:text-neutral-900">
              W
            </div>
            <span>WrapShop OS</span>
          </div>
          <nav className="hidden items-center gap-6 text-sm md:flex">
            <a href="#features" className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">Features</a>
            <a href="#pricing" className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">Pricing</a>
          </nav>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/login" className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">
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
            For wrap · PPF · tint · ceramic shops
          </p>
          <h1 className="text-5xl font-semibold leading-tight tracking-tight sm:text-6xl">
            Run your whole restyling shop from one place.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-neutral-600 dark:text-neutral-400">
            Leads to invoices, with a production Kanban, real material tracking,
            magic-link customer portal, and QuickBooks-first billing. Built by
            people who&apos;ve spent time in a wrap bay.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-md bg-neutral-900 px-5 py-3 text-neutral-50 hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              Start free <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#features"
              className="rounded-md border border-neutral-300 px-5 py-3 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              See features
            </a>
          </div>
          <p className="mt-6 text-xs text-neutral-500">
            No credit card required · Cancel any time · QuickBooks Online integration
          </p>
        </div>
      </section>

      {/* Features grid */}
      <section id="features" className="border-t border-neutral-200 py-16 dark:border-neutral-800">
        <div className="mx-auto max-w-6xl px-6">
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-neutral-500">Features</p>
          <h2 className="text-3xl font-semibold tracking-tight">Everything the shop actually needs.</h2>
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
                  <Icon className="mb-3 h-5 w-5 text-neutral-500" />
                  <h3 className="text-sm font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-sm text-neutral-600 dark:text-neutral-400">{f.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-neutral-200 py-16 dark:border-neutral-800">
        <div className="mx-auto max-w-6xl px-6">
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-neutral-500">Pricing</p>
          <h2 className="text-3xl font-semibold tracking-tight">Simple. Grows with your shop.</h2>
          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
            {TIERS.map((tier) => (
              <div
                key={tier.name}
                className={`rounded-lg border p-6 ${
                  tier.highlighted
                    ? "border-neutral-900 bg-neutral-900 text-neutral-50 dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                    : "border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950"
                }`}
              >
                <h3 className="text-lg font-semibold">{tier.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-semibold">{tier.price}</span>
                  {tier.period && <span className="text-sm opacity-80">/ {tier.period}</span>}
                </div>
                <p className={`mt-2 text-sm ${tier.highlighted ? "opacity-90" : "text-neutral-600 dark:text-neutral-400"}`}>
                  {tier.tag}
                </p>
                <ul className="mt-6 space-y-2 text-sm">
                  {tier.perks.map((perk) => (
                    <li key={perk} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
                      <span>{perk}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={tier.href}
                  className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-2 ${
                    tier.highlighted
                      ? "bg-neutral-50 text-neutral-900 hover:bg-neutral-200 dark:bg-neutral-900 dark:text-neutral-50 dark:hover:bg-neutral-800"
                      : "bg-neutral-900 text-neutral-50 hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
                  }`}
                >
                  {tier.cta} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-neutral-200 py-8 dark:border-neutral-800">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 text-xs text-neutral-500 sm:flex-row">
          <span>WrapShop OS — built for automotive restyling businesses.</span>
          <span>&copy; {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
