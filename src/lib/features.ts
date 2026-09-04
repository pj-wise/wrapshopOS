/**
 * Feature-flag catalog — source of truth for what capabilities exist and their default state.
 *
 * Resolution order at runtime (FeatureService.resolveState):
 *   1. UserFeatureOverride (scope=user)
 *   2. OrgFeatureOverride  (scope=org)
 *   3. LocationFeatureOverride (scope=location)
 *   4. SubscriptionTier gate (feature.minimumTier vs org.tier)
 *   5. defaultState from this catalog
 *
 * Server: `await features.isEnabled(ctx, "vehicle.vin_decoding")`
 *         `await features.require(ctx, "quickbooks.payments")`
 * Client: `useFeature("ai.assistant")`
 *
 * IMPORTANT: `minimumTier` is REQUIRED on every feature. This prevents the
 * common accident of adding a new gated feature and forgetting to tier-lock
 * it — TypeScript will refuse to build if any entry omits the field.
 */

export type FeatureState =
  | "enabled"
  | "disabled"
  | "coming_soon"
  | "beta"
  | "requires_integration"
  | "requires_subscription"
  | "unavailable";

export type FeatureCategory =
  | "core"
  | "vehicle"
  | "messaging"
  | "payments"
  | "accounting"
  | "location"
  | "ai"
  | "visualizer"
  | "calendar"
  | "esign"
  | "automation"
  | "reporting"
  | "inventory"
  | "operations"
  | "enterprise";

export type SubscriptionTier =
  | "free"
  | "solo"
  | "shop"
  | "pro"
  | "enterprise";

/**
 * Any legacy value that might still be persisted on Organization.tier —
 * mapped forward to the new 5-tier hierarchy. Never silently downgrades:
 * `"starter"` bumps up to `"solo"` (grandfathering).
 */
export function normalizeLegacyTier(value: string | null | undefined): SubscriptionTier {
  switch (value) {
    case "free":
    case "solo":
    case "shop":
    case "pro":
    case "enterprise":
      return value;
    // Legacy 3-tier values.
    case "starter":
      return "solo"; // grandfather starter → solo, never downgrade
    default:
      return "free"; // unknown / null → free (safe default; can't accidentally grant premium)
  }
}

export type FeatureDef = {
  key: string;
  name: string;
  category: FeatureCategory;
  defaultState: FeatureState;
  /** Matches ExternalIntegration.capability. Only set when the feature needs a wired integration. */
  requiresIntegration?: string;
  /** REQUIRED. Lowest tier that can access this feature. Enforced at compile time. */
  minimumTier: SubscriptionTier;
  internalOnly?: boolean;
  description: string;
  /** Shown in FeatureTooltip / FeatureUnavailableDialog. */
  upgradeCopy: string;
};

export const FEATURES = [
  // ==== Core (Free tier — always on for every org) ====
  {
    key: "core.customers",
    name: "Customer records",
    category: "core",
    defaultState: "enabled",
    minimumTier: "free",
    description: "Unlimited customer records with contact info + history.",
    upgradeCopy: "",
  },
  {
    key: "core.vehicles",
    name: "Vehicle records",
    category: "core",
    defaultState: "enabled",
    minimumTier: "free",
    description: "Unlimited vehicles tied to customers with VIN + service history.",
    upgradeCopy: "",
  },
  {
    key: "core.quotes",
    name: "Quotes",
    category: "core",
    defaultState: "enabled",
    minimumTier: "free",
    description: "Unlimited quotes with line items and totals.",
    upgradeCopy: "",
  },
  {
    key: "core.jobs",
    name: "Jobs",
    category: "core",
    defaultState: "enabled",
    minimumTier: "free",
    description: "Unlimited jobs with status pipeline and scheduling.",
    upgradeCopy: "",
  },
  {
    key: "core.calendar",
    name: "Calendar + scheduling",
    category: "core",
    defaultState: "enabled",
    minimumTier: "free",
    description: "Day / week / month schedule for jobs and events.",
    upgradeCopy: "",
  },
  {
    key: "core.invoices",
    name: "Basic invoices",
    category: "core",
    defaultState: "enabled",
    minimumTier: "free",
    description: "Create invoices from jobs. Manual payment tracking.",
    upgradeCopy: "",
  },
  {
    key: "core.pricing_calculator",
    name: "Pricing calculator",
    category: "core",
    defaultState: "enabled",
    minimumTier: "free",
    description: "Wrap / tint / PPF estimator with per-sqft rates + labor + margin controls.",
    upgradeCopy: "",
  },
  {
    key: "core.pricing_calculator_save",
    name: "Save calculator estimates",
    category: "core",
    defaultState: "enabled",
    minimumTier: "free",
    description: "Persist calculator estimates as draft quotes tied to a customer.",
    upgradeCopy: "",
  },

  // ==== Vehicle data ====
  {
    key: "vehicle.vin_decoding",
    name: "VIN Decode",
    category: "vehicle",
    defaultState: "enabled",
    requiresIntegration: "vehicle_data",
    minimumTier: "solo",
    description: "Automatically identify basic vehicle information from its VIN.",
    upgradeCopy:
      "VIN decoding is a Solo feature. Upgrade to skip manual vehicle entry.",
  },
  {
    key: "vehicle.advanced_data",
    name: "Advanced Vehicle Data",
    category: "vehicle",
    defaultState: "coming_soon",
    requiresIntegration: "vehicle_data",
    minimumTier: "solo",
    description: "Detailed trim, dimensions, factory options, and paint information.",
    upgradeCopy:
      "Requires connecting an enhanced automotive data provider (e.g. DataOne, CarMD).",
  },
  {
    key: "vehicle.plate_lookup",
    name: "License Plate Lookup",
    category: "vehicle",
    defaultState: "coming_soon",
    requiresIntegration: "vehicle_data",
    minimumTier: "solo",
    description: "Identify a vehicle from its license plate.",
    upgradeCopy: "Requires a compatible plate-to-VIN vehicle-data provider.",
  },
  {
    key: "vehicle.images",
    name: "Vehicle Images",
    category: "vehicle",
    defaultState: "coming_soon",
    requiresIntegration: "vehicle_data",
    minimumTier: "solo",
    description: "Automatically retrieve reference imagery for a decoded vehicle.",
    upgradeCopy: "Requires a vehicle-data provider that includes licensed imagery.",
  },

  // ==== Messaging ====
  {
    key: "messaging.sms",
    name: "SMS Messaging",
    category: "messaging",
    defaultState: "requires_integration",
    requiresIntegration: "messaging",
    minimumTier: "solo",
    description: "Two-way texting with customers.",
    upgradeCopy:
      "SMS is a Solo feature. Requires a messaging provider (Twilio or Telnyx). Carrier fees apply.",
  },
  {
    key: "messaging.mms",
    name: "MMS Messaging",
    category: "messaging",
    defaultState: "coming_soon",
    requiresIntegration: "messaging",
    minimumTier: "solo",
    description: "Send and receive images by text.",
    upgradeCopy: "Requires a messaging provider with MMS support.",
  },
  {
    key: "messaging.email",
    name: "Email Messaging",
    category: "messaging",
    defaultState: "enabled",
    requiresIntegration: "email",
    minimumTier: "solo",
    description: "Send and receive email with customers, quotes, receipts, and reminders.",
    upgradeCopy: "Email messaging is a Solo feature. Requires an email provider (Resend by default).",
  },

  // ==== Payments (Stripe — separate from accounting) ====
  {
    key: "payments.stripe",
    name: "Stripe Payments",
    category: "payments",
    defaultState: "requires_integration",
    requiresIntegration: "payments",
    minimumTier: "solo",
    description: "Collect deposits + invoice payments via Stripe Checkout.",
    upgradeCopy: "Stripe payment collection is a Solo feature.",
  },
  {
    key: "payments.deposits",
    name: "Digital Deposits",
    category: "payments",
    defaultState: "requires_integration",
    requiresIntegration: "payments",
    minimumTier: "solo",
    description: "Collect deposits online with fixed-amount or percentage-based rules.",
    upgradeCopy: "Digital deposits are a Solo feature.",
  },
  {
    key: "payments.online_links",
    name: "Online Payment Links",
    category: "payments",
    defaultState: "requires_integration",
    requiresIntegration: "payments",
    minimumTier: "solo",
    description: "Send customers a hosted pay link generated from any invoice.",
    upgradeCopy: "Payment links are a Solo feature.",
  },

  // ==== Accounting (QuickBooks — separate from payments) ====
  {
    key: "accounting.quickbooks",
    name: "QuickBooks Online",
    category: "accounting",
    defaultState: "requires_integration",
    requiresIntegration: "accounting",
    minimumTier: "solo",
    description: "Sync customers, invoices, and payments with QuickBooks Online.",
    upgradeCopy: "QuickBooks sync is a Solo feature. Connect your QBO company from Integrations.",
  },
  {
    key: "accounting.invoice_sync",
    name: "Invoice Sync",
    category: "accounting",
    defaultState: "requires_integration",
    requiresIntegration: "accounting",
    minimumTier: "solo",
    description: "Push app invoices to QuickBooks automatically.",
    upgradeCopy: "Requires an active QuickBooks Online connection.",
  },
  {
    key: "accounting.payment_sync",
    name: "Payment Sync",
    category: "accounting",
    defaultState: "requires_integration",
    requiresIntegration: "accounting",
    minimumTier: "solo",
    description: "Reflect Stripe / cash / check payments back into QuickBooks.",
    upgradeCopy: "Requires QuickBooks Online.",
  },
  {
    key: "accounting.qbo_payment_links",
    name: "QuickBooks-Hosted Pay Links",
    category: "accounting",
    defaultState: "requires_integration",
    requiresIntegration: "accounting",
    minimumTier: "solo",
    description: "Alternative pay-link routed through QuickBooks Payments. Stripe is recommended.",
    upgradeCopy: "Requires QuickBooks Payments enabled on your company.",
  },

  // ==== Location + address ====
  {
    key: "location.address_autocomplete",
    name: "Address Autocomplete",
    category: "location",
    defaultState: "coming_soon",
    requiresIntegration: "address",
    minimumTier: "solo",
    description: "Suggest addresses while typing.",
    upgradeCopy: "Requires a supported address provider (Google Places or Smarty).",
  },
  {
    key: "location.maps",
    name: "Maps",
    category: "location",
    defaultState: "coming_soon",
    requiresIntegration: "address",
    minimumTier: "solo",
    description: "Display customer + job locations on a map.",
    upgradeCopy: "Requires a supported map provider.",
  },
  {
    key: "location.route_distance",
    name: "Distance-Based Quoting",
    category: "location",
    defaultState: "coming_soon",
    requiresIntegration: "address",
    minimumTier: "solo",
    description: "Compute travel distance / fee for mobile installs.",
    upgradeCopy: "Requires a supported routing provider.",
  },

  // ==== E-sign ====
  {
    key: "esign.basic",
    name: "Basic E-Signature",
    category: "esign",
    defaultState: "enabled",
    minimumTier: "solo",
    description: "Typed-name + timestamp + IP signature on quotes and check-in.",
    upgradeCopy:
      "Digital authorizations replace paper on Solo. Includes typed signatures + IP timestamps.",
  },
  {
    key: "esign.advanced",
    name: "Advanced E-Signature",
    category: "esign",
    defaultState: "coming_soon",
    minimumTier: "pro",
    description: "Legally enhanced signing via DocuSign or Dropbox Sign.",
    upgradeCopy: "Only needed for legally sophisticated multi-party workflows.",
  },

  // ==== Automation ====
  {
    key: "automation.templates",
    name: "Basic Automation Templates",
    category: "automation",
    defaultState: "enabled",
    minimumTier: "solo",
    description: "Pre-built follow-ups, reminders, and status notifications.",
    upgradeCopy: "Automation templates are a Solo feature.",
  },
  {
    key: "automation.quote_followup",
    name: "Quote Follow-Up Automation",
    category: "automation",
    defaultState: "coming_soon",
    minimumTier: "shop",
    description: "Automatically nudge customers who haven't approved a sent quote.",
    upgradeCopy: "Quote follow-ups are a Shop feature.",
  },
  {
    key: "automation.customer_followup",
    name: "Customer Follow-Up Automation",
    category: "automation",
    defaultState: "coming_soon",
    minimumTier: "shop",
    description: "Nurture past customers with time-based follow-up messages.",
    upgradeCopy: "Customer follow-ups are a Shop feature.",
  },
  {
    key: "automation.review_requests",
    name: "Review Request Automation",
    category: "automation",
    defaultState: "coming_soon",
    minimumTier: "shop",
    description: "Automatically ask for reviews after successful deliveries.",
    upgradeCopy: "Review-request automation is a Shop feature.",
  },
  {
    key: "automation.advanced_builder",
    name: "Advanced Automation Builder",
    category: "automation",
    defaultState: "coming_soon",
    minimumTier: "pro",
    description: "Visual trigger + condition + action builder.",
    upgradeCopy: "The custom automation builder is a Pro feature.",
  },

  // ==== Inventory ====
  {
    key: "inventory.rolls",
    name: "Roll Inventory",
    category: "inventory",
    defaultState: "enabled",
    minimumTier: "solo",
    description: "Track film rolls by width and remaining length.",
    upgradeCopy: "Roll tracking is a Solo feature — essential for wrap/PPF/tint shops.",
  },
  {
    key: "inventory.barcode",
    name: "Barcode Scanning",
    category: "inventory",
    defaultState: "coming_soon",
    minimumTier: "shop",
    description: "Scan rolls in and out with your phone camera.",
    upgradeCopy: "Barcode scanning is a Shop feature.",
  },
  {
    key: "inventory.advanced_tracking",
    name: "Advanced Roll Usage",
    category: "inventory",
    defaultState: "coming_soon",
    minimumTier: "shop",
    description: "Per-job material usage attribution, waste tracking, roll profitability.",
    upgradeCopy: "Advanced inventory tracking is a Shop feature.",
  },

  // ==== Operations (mixed tiers) ====
  {
    key: "operations.warranties",
    name: "Warranties + Aftercare",
    category: "operations",
    defaultState: "enabled",
    minimumTier: "solo",
    description: "Auto-generated warranty records and aftercare instructions per service.",
    upgradeCopy: "Digital warranties are a Solo feature.",
  },
  {
    key: "operations.digital_inspections",
    name: "Digital Inspections",
    category: "operations",
    defaultState: "enabled",
    minimumTier: "solo",
    description: "Vehicle check-in condition reports with photos and signatures.",
    upgradeCopy:
      "Digital inspections replace paper on Solo. Includes photo capture + damage markers.",
  },
  {
    key: "operations.photo_annotation",
    name: "Photo Annotation",
    category: "operations",
    defaultState: "enabled",
    minimumTier: "solo",
    description: "Draw damage markers and notes directly on photos.",
    upgradeCopy: "Photo annotation is a Solo feature.",
  },
  {
    key: "operations.time_tracking",
    name: "Time Tracking",
    category: "operations",
    defaultState: "enabled",
    minimumTier: "shop",
    description: "Clock in/out per job or task with installer productivity metrics.",
    upgradeCopy: "Time tracking is a Shop feature — designed for teams.",
  },
  {
    key: "operations.mobile_check_in",
    name: "Mobile Check-In",
    category: "operations",
    defaultState: "enabled",
    minimumTier: "shop",
    description:
      "Hand check-ins to the tech's phone for photo capture, or record a signed opt-out for liability defense.",
    upgradeCopy: "Mobile check-in is a Shop feature.",
  },
  {
    key: "operations.team_assignments",
    name: "Team Assignments",
    category: "operations",
    defaultState: "enabled",
    minimumTier: "shop",
    description: "Assign jobs to specific installers/technicians with per-tech schedule visibility.",
    upgradeCopy: "Team assignments are a Shop feature.",
  },
  {
    key: "operations.roles_permissions",
    name: "Roles + Permissions",
    category: "operations",
    defaultState: "enabled",
    minimumTier: "shop",
    description: "Configure which team members can see and do what.",
    upgradeCopy: "Custom roles are a Shop feature.",
  },

  // ==== Reporting ====
  {
    key: "reporting.basic_profitability",
    name: "Basic Job Profitability",
    category: "reporting",
    defaultState: "coming_soon",
    minimumTier: "shop",
    description: "Labor cost vs. revenue per job with material spend attribution.",
    upgradeCopy: "Job profitability reporting is a Shop feature.",
  },
  {
    key: "reporting.advanced",
    name: "Advanced Reporting",
    category: "reporting",
    defaultState: "coming_soon",
    minimumTier: "pro",
    description: "Cohort analysis, LTV, funnel drilldowns, close-rate + lead-source performance.",
    upgradeCopy: "Advanced reporting is a Pro feature.",
  },
  {
    key: "reporting.review_analytics",
    name: "Review Analytics",
    category: "reporting",
    defaultState: "coming_soon",
    minimumTier: "pro",
    description: "Sentiment + response tracking across review platforms.",
    upgradeCopy: "Basic review-link redirects are available on Shop; analytics is Pro.",
  },
  {
    key: "reporting.pricing_intelligence",
    name: "Pricing Intelligence",
    category: "reporting",
    defaultState: "coming_soon",
    minimumTier: "pro",
    description: "Historical price analysis + recommended pricing per service.",
    upgradeCopy: "Pricing intelligence is a Pro feature.",
  },

  // ==== Calendar sync ====
  {
    key: "calendar.google_sync",
    name: "Google Calendar Sync",
    category: "calendar",
    defaultState: "coming_soon",
    minimumTier: "shop",
    description: "Two-way sync with an employee's Google Calendar.",
    upgradeCopy: "Calendar sync is a Shop feature.",
  },
  {
    key: "calendar.microsoft_sync",
    name: "Microsoft Calendar Sync",
    category: "calendar",
    defaultState: "coming_soon",
    minimumTier: "shop",
    description: "Two-way sync with an employee's Outlook / Microsoft 365 calendar.",
    upgradeCopy: "Calendar sync is a Shop feature.",
  },

  // ==== AI ====
  {
    key: "ai.assistant",
    name: "autoLuxOS AI Assistant",
    category: "ai",
    defaultState: "coming_soon",
    requiresIntegration: "ai",
    minimumTier: "pro",
    description: "AI-powered summaries, replies, and business insights.",
    upgradeCopy:
      "AI is a Pro feature. Usage-based fair-use allowance included.",
  },
  {
    key: "ai.message_drafting",
    name: "AI Message Drafts",
    category: "ai",
    defaultState: "coming_soon",
    requiresIntegration: "ai",
    minimumTier: "pro",
    description: "Suggest reply drafts based on your shop's history and policies.",
    upgradeCopy: "Requires the AI Assistant (Pro).",
  },
  {
    key: "ai.message_summarization",
    name: "AI Conversation Summaries",
    category: "ai",
    defaultState: "coming_soon",
    requiresIntegration: "ai",
    minimumTier: "pro",
    description: "Summarize long customer conversations.",
    upgradeCopy: "Requires the AI Assistant (Pro).",
  },
  {
    key: "ai.photo_analysis",
    name: "AI Photo Analysis",
    category: "ai",
    defaultState: "coming_soon",
    requiresIntegration: "ai",
    minimumTier: "pro",
    description: "Categorize photos and detect visible damage automatically.",
    upgradeCopy: "Requires a vision-capable AI provider. Not a substitute for human inspection.",
  },
  {
    key: "ai.analytics",
    name: "AI Analytics",
    category: "ai",
    defaultState: "coming_soon",
    requiresIntegration: "ai",
    minimumTier: "pro",
    description: "Ask natural-language questions about your shop's numbers.",
    upgradeCopy: "Requires the AI Assistant (Pro).",
  },
  {
    key: "ai.quote_recommendations",
    name: "AI Quote Recommendations",
    category: "ai",
    defaultState: "coming_soon",
    requiresIntegration: "ai",
    minimumTier: "pro",
    description: "Suggest labor, material, and pricing based on historical jobs.",
    upgradeCopy: "Requires the AI Assistant and at least ~30 comparable historical jobs.",
  },

  // ==== 3D Visualizer ====
  {
    key: "visualizer.vehicle_3d",
    name: "3D Vehicle Visualizer",
    category: "visualizer",
    defaultState: "coming_soon",
    minimumTier: "pro",
    description: "Preview vinyl, PPF, and tint on an interactive vehicle model.",
    upgradeCopy:
      "The 3D visualizer is a Pro feature. Vehicle model availability expands over time.",
  },
  {
    key: "visualizer.film_3d",
    name: "Film Visualizer",
    category: "visualizer",
    defaultState: "coming_soon",
    minimumTier: "pro",
    description: "Render generic gloss / satin / matte / chrome / carbon films.",
    upgradeCopy: "Enabled together with the 3D Vehicle Visualizer (Pro).",
  },
  {
    key: "visualizer.tint",
    name: "Tint Visualizer",
    category: "visualizer",
    defaultState: "coming_soon",
    minimumTier: "pro",
    description: "Preview VLT levels on vehicle glass.",
    upgradeCopy: "Enabled together with the 3D Vehicle Visualizer (Pro).",
  },
  {
    key: "visualizer.ppf_panel_selector",
    name: "PPF Panel Selector",
    category: "visualizer",
    defaultState: "coming_soon",
    minimumTier: "pro",
    description: "Interactively select PPF coverage per panel.",
    upgradeCopy: "Enabled together with the 3D Vehicle Visualizer (Pro).",
  },
  {
    key: "visualizer.ppf_pattern_integration",
    name: "PPF Pattern Integration",
    category: "visualizer",
    defaultState: "coming_soon",
    minimumTier: "enterprise",
    description: "Connect selected PPF coverage to a pattern/template provider and cut queue.",
    upgradeCopy:
      "Pattern integration is an Enterprise feature. Contact sales if your shop is interested.",
  },

  // ==== Enterprise / multi-location ====
  {
    key: "operations.multi_location",
    name: "Multiple Locations",
    category: "enterprise",
    defaultState: "enabled",
    minimumTier: "enterprise",
    description: "Manage more than one physical shop location.",
    upgradeCopy:
      "Multi-location is an Enterprise feature. Volume pricing per shop starts at $89/location.",
  },
  {
    key: "operations.cross_location_reporting",
    name: "Cross-Location Reporting",
    category: "enterprise",
    defaultState: "coming_soon",
    minimumTier: "enterprise",
    description: "Compare + roll up numbers across every shop location.",
    upgradeCopy: "Cross-location reporting is an Enterprise feature.",
  },
  {
    key: "operations.centralized_admin",
    name: "Centralized Administration",
    category: "enterprise",
    defaultState: "coming_soon",
    minimumTier: "enterprise",
    description: "Manage customers, staff, integrations, and billing across all locations.",
    upgradeCopy: "Centralized admin is an Enterprise feature.",
  },
  {
    key: "enterprise.sso",
    name: "Single Sign-On (SSO)",
    category: "enterprise",
    defaultState: "coming_soon",
    minimumTier: "enterprise",
    description: "SAML / OIDC single sign-on with identity providers.",
    upgradeCopy: "SSO is an Enterprise feature.",
  },
  {
    key: "enterprise.audit_logs",
    name: "Audit Logs",
    category: "enterprise",
    defaultState: "coming_soon",
    minimumTier: "enterprise",
    description: "Full org-wide audit trail with export.",
    upgradeCopy: "Audit-log export is an Enterprise feature.",
  },
  {
    key: "enterprise.api_access",
    name: "API Access",
    category: "enterprise",
    defaultState: "coming_soon",
    minimumTier: "enterprise",
    description: "Public REST API for custom integrations and reporting pipelines.",
    upgradeCopy: "Public API access is an Enterprise feature.",
  },
  {
    key: "enterprise.sla",
    name: "Dedicated Support + SLA",
    category: "enterprise",
    defaultState: "coming_soon",
    minimumTier: "enterprise",
    description: "Priority support with response-time guarantees and named account manager.",
    upgradeCopy: "SLA support is an Enterprise feature.",
  },
] as const satisfies readonly FeatureDef[];

export type FeatureKey = (typeof FEATURES)[number]["key"];

export const FEATURE_KEYS: FeatureKey[] = FEATURES.map((f) => f.key);

export function getFeature(key: FeatureKey): FeatureDef {
  const feature = FEATURES.find((f) => f.key === key);
  if (!feature) throw new Error(`Unknown feature key: ${key}`);
  return feature;
}

export const TIER_RANK: Record<SubscriptionTier, number> = {
  free: 0,
  solo: 1,
  shop: 2,
  pro: 3,
  enterprise: 4,
};

/** Every valid tier value, in ascending order. Useful for UI iteration + zod enums. */
export const TIERS: readonly SubscriptionTier[] = [
  "free",
  "solo",
  "shop",
  "pro",
  "enterprise",
] as const;
