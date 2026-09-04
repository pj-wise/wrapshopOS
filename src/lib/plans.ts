/**
 * Plan configuration — single source of truth for pricing, entitlements,
 * and public marketing copy per subscription tier.
 *
 * NEVER duplicate these numbers in JSX. If a pricing card shows "$29/mo",
 * it reads from PLANS.solo.monthlyPriceCents. Same for feature limits.
 *
 * This module is CLIENT-SAFE — used by the landing page, pricing table,
 * upgrade dialogs, and the /settings/billing page. No server-only imports.
 */

import type { SubscriptionTier } from "./features";

export type PlanId = SubscriptionTier;

export type PlanEntitlements = {
  /** null = unlimited. Free is 1; paid tiers are unlimited. */
  maxUsers: number | null;
  /** How many physical shop locations included in the base subscription. */
  maxLocations: number;
  /** Customer/job media storage. Enforced later; declared now for planning. */
  storageBytes: number;
  /** null = no metering yet. Numbers = monthly allowance. */
  aiRequestsPerMonth: number | null;
  smsMessagesPerMonth: number | null;
};

export type PlanConfig = {
  id: PlanId;
  displayName: string;
  tagline: string;
  /** null when priced per-location (Enterprise). */
  monthlyPriceCents: number | null;
  /** null when priced per-location. Otherwise ~10x monthly = ~2 free months. */
  annualPriceCents: number | null;
  perLocationPricing: boolean;
  entitlements: PlanEntitlements;
  /** Public marketing bullets for the pricing card. */
  marketingBullets: readonly string[];
  /** Display order on pricing page. */
  order: number;
  /** Highlight one plan visually ("Most Popular"). */
  recommended?: boolean;
  /**
   * Stripe price ID (set once you create products in Stripe dashboard).
   * Wire this up in Phase 7 / follow-up work. Enterprise doesn't have one —
   * it's per-location, priced via `calculateEnterpriseMonthlyPrice`.
   */
  stripePriceIdMonthly?: string;
  stripePriceIdAnnual?: string;
};

const GB = 1024 ** 3;

export const PLANS: Record<PlanId, PlanConfig> = {
  free: {
    id: "free",
    displayName: "Free",
    tagline: "Get organized",
    monthlyPriceCents: 0,
    annualPriceCents: 0,
    perLocationPricing: false,
    order: 0,
    entitlements: {
      maxUsers: 1,
      maxLocations: 1,
      storageBytes: 0,
      aiRequestsPerMonth: 0,
      smsMessagesPerMonth: 0,
    },
    marketingBullets: [
      "Unlimited customers, quotes, and jobs",
      "1 user · 1 location",
      "Basic scheduling + invoicing",
      "Manual payment tracking",
    ],
  },
  solo: {
    id: "solo",
    displayName: "Solo",
    tagline: "Run your business",
    monthlyPriceCents: 2900,
    annualPriceCents: 29000, // 10x = 2 free months
    perLocationPricing: false,
    order: 1,
    entitlements: {
      maxUsers: null,
      maxLocations: 1,
      storageBytes: 5 * GB,
      aiRequestsPerMonth: 0,
      smsMessagesPerMonth: 500,
    },
    marketingBullets: [
      "Everything in Free",
      "Unlimited users",
      "Digital inspections + e-signatures",
      "Stripe payments + deposits",
      "QuickBooks sync",
      "SMS + MMS",
      "Roll inventory",
      "Digital warranties + aftercare",
    ],
  },
  shop: {
    id: "shop",
    displayName: "Shop",
    tagline: "Run your team",
    monthlyPriceCents: 5900,
    annualPriceCents: 59000,
    perLocationPricing: false,
    order: 2,
    recommended: true,
    entitlements: {
      maxUsers: null,
      maxLocations: 1,
      storageBytes: 25 * GB,
      aiRequestsPerMonth: 0,
      smsMessagesPerMonth: 2000,
    },
    marketingBullets: [
      "Everything in Solo",
      "Team assignments + roles",
      "Time tracking + mobile check-in",
      "Barcode scanning + advanced inventory",
      "Google + Microsoft calendar sync",
      "Quote / customer / review automations",
      "Basic job profitability",
    ],
  },
  pro: {
    id: "pro",
    displayName: "Pro",
    tagline: "Grow your business",
    monthlyPriceCents: 9900,
    annualPriceCents: 99000,
    perLocationPricing: false,
    order: 3,
    entitlements: {
      maxUsers: null,
      maxLocations: 1,
      storageBytes: 100 * GB,
      aiRequestsPerMonth: 5000,
      smsMessagesPerMonth: 5000,
    },
    marketingBullets: [
      "Everything in Shop",
      "autoLuxOS AI Assistant",
      "AI quote recommendations",
      "Advanced automation builder",
      "3D visualizer (vehicle / film / tint / PPF)",
      "Advanced reporting + pricing intelligence",
      "Advanced e-signature integrations",
    ],
  },
  enterprise: {
    id: "enterprise",
    displayName: "Enterprise",
    tagline: "Multi-location",
    monthlyPriceCents: null, // per-location — see calculateEnterpriseMonthlyPrice
    annualPriceCents: null,
    perLocationPricing: true,
    order: 4,
    entitlements: {
      maxUsers: null,
      maxLocations: Number.POSITIVE_INFINITY, // billed per location
      storageBytes: 500 * GB, // per-location baseline; adjust later if needed
      aiRequestsPerMonth: null,
      smsMessagesPerMonth: null,
    },
    marketingBullets: [
      "Everything in Pro",
      "Volume pricing per location",
      "Cross-location dashboard + reporting",
      "Centralized administration",
      "PPF pattern integration",
      "SSO, audit logs, API access",
      "Dedicated support + SLA",
    ],
  },
} as const;

/**
 * Multi-location volume pricing. Bands are inclusive on both ends;
 * `maxLocations: null` means "no upper bound."
 *
 * 2–4  → $89/loc/mo  (bumping up from a single-location Pro tier)
 * 5–9  → $79/loc/mo
 * 10+  → $69/loc/mo
 */
export const ENTERPRISE_PRICING_BANDS = [
  { minLocations: 2, maxLocations: 4, perLocationCents: 8900 },
  { minLocations: 5, maxLocations: 9, perLocationCents: 7900 },
  { minLocations: 10, maxLocations: null as number | null, perLocationCents: 6900 },
] as const;

export type EnterprisePricingBand = (typeof ENTERPRISE_PRICING_BANDS)[number];

export type EnterprisePriceResult = {
  perLocationCents: number;
  totalMonthlyCents: number;
  band: EnterprisePricingBand;
  /** When locationCount === 1, direct the customer to Free/Solo/Shop/Pro instead. */
  suggestedNonEnterprisePlan?: PlanId;
};

export function calculateEnterpriseMonthlyPrice(
  locationCount: number,
): EnterprisePriceResult {
  if (!Number.isFinite(locationCount) || locationCount < 1) {
    throw new Error(
      `calculateEnterpriseMonthlyPrice: invalid locationCount ${locationCount}`,
    );
  }

  if (locationCount === 1) {
    // Single-location shops should pick a flat-price plan, not Enterprise.
    // Return the entry band's rate for math continuity, but flag the mismatch
    // so callers can render "Choose Pro instead" copy.
    const entryBand = ENTERPRISE_PRICING_BANDS[0];
    return {
      perLocationCents: entryBand.perLocationCents,
      totalMonthlyCents: entryBand.perLocationCents,
      band: entryBand,
      suggestedNonEnterprisePlan: "pro",
    };
  }

  const band = ENTERPRISE_PRICING_BANDS.find(
    (b) =>
      locationCount >= b.minLocations &&
      (b.maxLocations == null || locationCount <= b.maxLocations),
  );
  if (!band) {
    // Should be unreachable given the last band is unbounded, but guard anyway.
    throw new Error(
      `calculateEnterpriseMonthlyPrice: no band matched locationCount ${locationCount}`,
    );
  }

  return {
    perLocationCents: band.perLocationCents,
    totalMonthlyCents: band.perLocationCents * locationCount,
    band,
  };
}

/** Ordered list for iteration on pricing table + upgrade prompts. */
export const PLAN_ORDER: PlanId[] = ["free", "solo", "shop", "pro", "enterprise"];

/** Look up the plan config for a given tier. */
export function getPlan(id: PlanId): PlanConfig {
  return PLANS[id];
}

/**
 * Format cents as USD. Small helper here to avoid a UI-side import when the
 * pricing table is server-rendered.
 */
export function formatPriceCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
