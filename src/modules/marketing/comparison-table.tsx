import { Check, Minus } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Public feature-comparison table. Deliberately curated — projects the internal
 * feature catalog into shopper-friendly categories + capabilities rather than
 * dumping the raw feature-flag keys.
 *
 * When the catalog changes, update this table by hand. Keeping it hand-curated
 * lets us reorder + rename for marketing without touching entitlement logic.
 */

type PlanColumn = "free" | "solo" | "shop" | "pro" | "enterprise";

type Row = {
  label: string;
  presence: Record<PlanColumn, boolean | string>;
};

type Section = {
  title: string;
  rows: Row[];
};

const SECTIONS: Section[] = [
  {
    title: "Core business",
    rows: [
      {
        label: "Unlimited customers, quotes, jobs",
        presence: { free: true, solo: true, shop: true, pro: true, enterprise: true },
      },
      {
        label: "Users",
        presence: {
          free: "1",
          solo: "Unlimited",
          shop: "Unlimited",
          pro: "Unlimited",
          enterprise: "Unlimited",
        },
      },
      {
        label: "Physical locations",
        presence: {
          free: "1",
          solo: "1",
          shop: "1",
          pro: "1",
          enterprise: "2+ (volume pricing)",
        },
      },
      {
        label: "Media storage",
        presence: {
          free: "—",
          solo: "5 GB",
          shop: "25 GB",
          pro: "100 GB",
          enterprise: "500 GB / location",
        },
      },
    ],
  },
  {
    title: "Customer experience",
    rows: [
      {
        label: "Digital inspections + photos",
        presence: { free: false, solo: true, shop: true, pro: true, enterprise: true },
      },
      {
        label: "E-signatures",
        presence: { free: false, solo: true, shop: true, pro: true, enterprise: true },
      },
      {
        label: "Digital warranties + aftercare",
        presence: { free: false, solo: true, shop: true, pro: true, enterprise: true },
      },
      {
        label: "Photo annotation",
        presence: { free: false, solo: true, shop: true, pro: true, enterprise: true },
      },
      {
        label: "Advanced e-signature (DocuSign / Dropbox Sign)",
        presence: { free: false, solo: false, shop: false, pro: "Coming soon", enterprise: "Coming soon" },
      },
    ],
  },
  {
    title: "Payments & accounting",
    rows: [
      {
        label: "Stripe payments",
        presence: { free: false, solo: true, shop: true, pro: true, enterprise: true },
      },
      {
        label: "Deposits + online pay links",
        presence: { free: false, solo: true, shop: true, pro: true, enterprise: true },
      },
      {
        label: "QuickBooks Online sync",
        presence: { free: false, solo: true, shop: true, pro: true, enterprise: true },
      },
    ],
  },
  {
    title: "Messaging",
    rows: [
      {
        label: "Email",
        presence: { free: false, solo: true, shop: true, pro: true, enterprise: true },
      },
      {
        label: "SMS",
        presence: { free: false, solo: true, shop: true, pro: true, enterprise: true },
      },
      {
        label: "MMS",
        presence: { free: false, solo: "Coming soon", shop: "Coming soon", pro: "Coming soon", enterprise: "Coming soon" },
      },
    ],
  },
  {
    title: "Vehicle tools",
    rows: [
      {
        label: "VIN decode",
        presence: { free: false, solo: true, shop: true, pro: true, enterprise: true },
      },
      {
        label: "Advanced vehicle data",
        presence: { free: false, solo: "Coming soon", shop: "Coming soon", pro: "Coming soon", enterprise: "Coming soon" },
      },
      {
        label: "License plate lookup",
        presence: { free: false, solo: "Coming soon", shop: "Coming soon", pro: "Coming soon", enterprise: "Coming soon" },
      },
    ],
  },
  {
    title: "Inventory",
    rows: [
      {
        label: "Roll inventory",
        presence: { free: false, solo: true, shop: true, pro: true, enterprise: true },
      },
      {
        label: "Barcode scanning",
        presence: { free: false, solo: false, shop: "Coming soon", pro: "Coming soon", enterprise: "Coming soon" },
      },
      {
        label: "Advanced roll usage / waste tracking",
        presence: { free: false, solo: false, shop: "Coming soon", pro: "Coming soon", enterprise: "Coming soon" },
      },
    ],
  },
  {
    title: "Team operations",
    rows: [
      {
        label: "Time tracking",
        presence: { free: false, solo: false, shop: true, pro: true, enterprise: true },
      },
      {
        label: "Mobile check-in",
        presence: { free: false, solo: false, shop: true, pro: true, enterprise: true },
      },
      {
        label: "Team assignments + roles",
        presence: { free: false, solo: false, shop: true, pro: true, enterprise: true },
      },
      {
        label: "Google + Microsoft calendar sync",
        presence: { free: false, solo: false, shop: "Coming soon", pro: "Coming soon", enterprise: "Coming soon" },
      },
    ],
  },
  {
    title: "Automation",
    rows: [
      {
        label: "Prebuilt templates",
        presence: { free: false, solo: true, shop: true, pro: true, enterprise: true },
      },
      {
        label: "Quote / customer / review follow-up",
        presence: { free: false, solo: false, shop: "Coming soon", pro: "Coming soon", enterprise: "Coming soon" },
      },
      {
        label: "Custom automation builder",
        presence: { free: false, solo: false, shop: false, pro: "Coming soon", enterprise: "Coming soon" },
      },
    ],
  },
  {
    title: "Reporting",
    rows: [
      {
        label: "Basic job profitability",
        presence: { free: false, solo: false, shop: "Coming soon", pro: "Coming soon", enterprise: "Coming soon" },
      },
      {
        label: "Advanced reporting (cohorts, LTV, funnels)",
        presence: { free: false, solo: false, shop: false, pro: "Coming soon", enterprise: "Coming soon" },
      },
      {
        label: "Pricing intelligence",
        presence: { free: false, solo: false, shop: false, pro: "Coming soon", enterprise: "Coming soon" },
      },
    ],
  },
  {
    title: "AI (autoLuxOS AI Assistant)",
    rows: [
      {
        label: "AI message drafts + summaries",
        presence: { free: false, solo: false, shop: false, pro: "Coming soon", enterprise: "Coming soon" },
      },
      {
        label: "AI photo analysis",
        presence: { free: false, solo: false, shop: false, pro: "Coming soon", enterprise: "Coming soon" },
      },
      {
        label: "AI quote recommendations",
        presence: { free: false, solo: false, shop: false, pro: "Coming soon", enterprise: "Coming soon" },
      },
    ],
  },
  {
    title: "Visualizer",
    rows: [
      {
        label: "3D vehicle + film + tint",
        presence: { free: false, solo: false, shop: false, pro: "Coming soon", enterprise: "Coming soon" },
      },
      {
        label: "PPF panel selector",
        presence: { free: false, solo: false, shop: false, pro: "Coming soon", enterprise: "Coming soon" },
      },
      {
        label: "PPF pattern-provider integration",
        presence: { free: false, solo: false, shop: false, pro: false, enterprise: "Coming soon" },
      },
    ],
  },
  {
    title: "Multi-location",
    rows: [
      {
        label: "2+ physical locations",
        presence: { free: false, solo: false, shop: false, pro: false, enterprise: true },
      },
      {
        label: "Cross-location dashboard",
        presence: { free: false, solo: false, shop: false, pro: false, enterprise: "Coming soon" },
      },
      {
        label: "Centralized administration",
        presence: { free: false, solo: false, shop: false, pro: false, enterprise: "Coming soon" },
      },
      {
        label: "SSO, audit logs, API access",
        presence: { free: false, solo: false, shop: false, pro: false, enterprise: "Coming soon" },
      },
    ],
  },
];

const COLUMNS: PlanColumn[] = ["free", "solo", "shop", "pro", "enterprise"];
const COLUMN_LABELS: Record<PlanColumn, string> = {
  free: "Free",
  solo: "Solo",
  shop: "Shop",
  pro: "Pro",
  enterprise: "Enterprise",
};

export function ComparisonTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 bg-white py-3 text-left text-xs font-medium uppercase tracking-widest text-neutral-500 dark:bg-neutral-950">
              Feature
            </th>
            {COLUMNS.map((col) => (
              <th
                key={col}
                className="px-3 py-3 text-center text-xs font-medium uppercase tracking-widest text-neutral-500"
              >
                {COLUMN_LABELS[col]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SECTIONS.map((section) => (
            <SectionRows key={section.title} section={section} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionRows({ section }: { section: Section }) {
  return (
    <>
      <tr className="bg-neutral-100/50 dark:bg-neutral-900/50">
        <td
          colSpan={COLUMNS.length + 1}
          className="sticky left-0 py-2 pl-1 text-xs font-semibold uppercase tracking-widest text-neutral-700 dark:text-neutral-300"
        >
          {section.title}
        </td>
      </tr>
      {section.rows.map((row) => (
        <tr key={row.label} className="border-t border-neutral-200 dark:border-neutral-800">
          <td className="sticky left-0 bg-white py-2.5 pl-1 pr-4 dark:bg-neutral-950">
            {row.label}
          </td>
          {COLUMNS.map((col) => (
            <td key={col} className="px-3 py-2.5 text-center">
              <PresenceCell value={row.presence[col]} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function PresenceCell({ value }: { value: boolean | string }) {
  if (value === true) {
    return (
      <Check className="mx-auto h-4 w-4 text-emerald-600 dark:text-emerald-400" />
    );
  }
  if (value === false) {
    return (
      <Minus className="mx-auto h-4 w-4 text-neutral-300 dark:text-neutral-700" />
    );
  }
  const isComingSoon = value === "Coming soon";
  return (
    <span
      className={cn(
        "text-xs",
        isComingSoon
          ? "text-amber-700 dark:text-amber-300"
          : "text-neutral-700 dark:text-neutral-300",
      )}
    >
      {value}
    </span>
  );
}
