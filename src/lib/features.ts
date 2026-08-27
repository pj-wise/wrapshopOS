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
  | "vehicle"
  | "messaging"
  | "accounting"
  | "location"
  | "ai"
  | "visualizer"
  | "calendar"
  | "esign"
  | "automation"
  | "reporting"
  | "inventory"
  | "operations";

export type SubscriptionTier = "starter" | "pro" | "enterprise";

export type FeatureDef = {
  key: string;
  name: string;
  category: FeatureCategory;
  defaultState: FeatureState;
  requiresIntegration?: string; // matches ExternalIntegration.capability
  minimumTier?: SubscriptionTier;
  internalOnly?: boolean;
  description: string;
  upgradeCopy: string; // shown in FeatureTooltip / FeatureUnavailableDialog
};

export const FEATURES = [
  // ==== Vehicle data ====
  {
    key: "vehicle.vin_decoding",
    name: "VIN Decode",
    category: "vehicle",
    defaultState: "enabled",
    requiresIntegration: "vehicle_data",
    description: "Automatically identify basic vehicle information from its VIN.",
    upgradeCopy:
      "Advanced trim, dimensions, and factory-option data require an enhanced vehicle-data provider.",
  },
  {
    key: "vehicle.advanced_data",
    name: "Advanced Vehicle Data",
    category: "vehicle",
    defaultState: "coming_soon",
    requiresIntegration: "vehicle_data",
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
    description: "Identify a vehicle from its license plate.",
    upgradeCopy: "Requires a compatible plate-to-VIN vehicle-data provider.",
  },
  {
    key: "vehicle.images",
    name: "Vehicle Images",
    category: "vehicle",
    defaultState: "coming_soon",
    requiresIntegration: "vehicle_data",
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
    description: "Two-way texting with customers.",
    upgradeCopy:
      "Requires a messaging provider (Twilio or Telnyx). Messaging and carrier charges may apply.",
  },
  {
    key: "messaging.mms",
    name: "MMS Messaging",
    category: "messaging",
    defaultState: "coming_soon",
    requiresIntegration: "messaging",
    description: "Send and receive images by text.",
    upgradeCopy: "Requires a messaging provider with MMS support.",
  },
  {
    key: "messaging.email",
    name: "Email Messaging",
    category: "messaging",
    defaultState: "enabled",
    requiresIntegration: "email",
    description: "Send and receive email with customers, quotes, receipts, and reminders.",
    upgradeCopy: "Requires an email provider (Resend by default).",
  },

  // ==== Accounting / Payments ====
  {
    key: "accounting.quickbooks",
    name: "QuickBooks Online",
    category: "accounting",
    defaultState: "requires_integration",
    requiresIntegration: "accounting",
    description: "Sync customers, invoices, and payments with QuickBooks Online.",
    upgradeCopy: "Connect your QuickBooks Online company from Integrations to enable sync.",
  },
  {
    key: "accounting.invoice_sync",
    name: "Invoice Sync",
    category: "accounting",
    defaultState: "requires_integration",
    requiresIntegration: "accounting",
    description: "Push app invoices to QuickBooks automatically.",
    upgradeCopy: "Requires an active QuickBooks Online connection.",
  },
  {
    key: "accounting.payments",
    name: "QuickBooks Payments",
    category: "accounting",
    defaultState: "requires_integration",
    requiresIntegration: "accounting",
    description: "Route customers through QuickBooks-hosted payment experiences.",
    upgradeCopy:
      "Requires a QuickBooks Online company with QuickBooks Payments enabled.",
  },
  {
    key: "accounting.online_payment_links",
    name: "Online Payment Links",
    category: "accounting",
    defaultState: "requires_integration",
    requiresIntegration: "accounting",
    description: "Send customers a hosted pay link generated from a synced invoice.",
    upgradeCopy: "Requires QuickBooks Payments enabled on your company.",
  },

  // ==== Location + address ====
  {
    key: "location.address_autocomplete",
    name: "Address Autocomplete",
    category: "location",
    defaultState: "coming_soon",
    requiresIntegration: "address",
    description: "Suggest addresses while typing.",
    upgradeCopy: "Requires a supported address provider (Google Places or Smarty).",
  },
  {
    key: "location.maps",
    name: "Maps",
    category: "location",
    defaultState: "coming_soon",
    requiresIntegration: "address",
    description: "Display customer + job locations on a map.",
    upgradeCopy: "Requires a supported map provider.",
  },
  {
    key: "location.route_distance",
    name: "Distance-Based Quoting",
    category: "location",
    defaultState: "coming_soon",
    requiresIntegration: "address",
    description: "Compute travel distance / fee for mobile installs.",
    upgradeCopy: "Requires a supported routing provider.",
  },

  // ==== AI ====
  {
    key: "ai.assistant",
    name: "AI Assistant",
    category: "ai",
    defaultState: "coming_soon",
    requiresIntegration: "ai",
    minimumTier: "pro",
    description: "AI-powered summaries, replies, and business insights.",
    upgradeCopy:
      "Requires an AI provider (Anthropic or OpenAI) on the Pro plan. Usage charges may apply.",
  },
  {
    key: "ai.message_drafting",
    name: "AI Message Drafts",
    category: "ai",
    defaultState: "coming_soon",
    requiresIntegration: "ai",
    minimumTier: "pro",
    description: "Suggest reply drafts based on your shop's history and policies.",
    upgradeCopy: "Requires the AI Assistant.",
  },
  {
    key: "ai.message_summarization",
    name: "AI Conversation Summaries",
    category: "ai",
    defaultState: "coming_soon",
    requiresIntegration: "ai",
    minimumTier: "pro",
    description: "Summarize long customer conversations.",
    upgradeCopy: "Requires the AI Assistant.",
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
    upgradeCopy: "Requires the AI Assistant. Runs against a controlled analytics layer.",
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
      "Vehicle model availability depends on our licensed 3D library — expanding over time.",
  },
  {
    key: "visualizer.film_3d",
    name: "Film Visualizer",
    category: "visualizer",
    defaultState: "coming_soon",
    minimumTier: "pro",
    description: "Render generic gloss / satin / matte / chrome / carbon films.",
    upgradeCopy: "Enabled together with the 3D Vehicle Visualizer.",
  },
  {
    key: "visualizer.tint",
    name: "Tint Visualizer",
    category: "visualizer",
    defaultState: "coming_soon",
    minimumTier: "pro",
    description: "Preview VLT levels on vehicle glass.",
    upgradeCopy: "Enabled together with the 3D Vehicle Visualizer.",
  },
  {
    key: "visualizer.ppf_panel_selector",
    name: "PPF Panel Selector",
    category: "visualizer",
    defaultState: "coming_soon",
    minimumTier: "pro",
    description: "Interactively select PPF coverage per panel.",
    upgradeCopy: "Enabled together with the 3D Vehicle Visualizer.",
  },
  {
    key: "visualizer.ppf_pattern_integration",
    name: "PPF Pattern Integration",
    category: "visualizer",
    defaultState: "coming_soon",
    minimumTier: "enterprise",
    description: "Connect selected PPF coverage to a pattern/template provider and cut queue.",
    upgradeCopy:
      "Requires a licensed pattern-provider integration. Contact us if your shop is interested.",
  },

  // ==== Calendar sync ====
  {
    key: "calendar.google_sync",
    name: "Google Calendar Sync",
    category: "calendar",
    defaultState: "coming_soon",
    description: "Two-way sync with an employee's Google Calendar.",
    upgradeCopy: "The shop calendar remains authoritative; external calendars sync as visibility.",
  },
  {
    key: "calendar.microsoft_sync",
    name: "Microsoft Calendar Sync",
    category: "calendar",
    defaultState: "coming_soon",
    description: "Two-way sync with an employee's Outlook / Microsoft 365 calendar.",
    upgradeCopy: "The shop calendar remains authoritative; external calendars sync as visibility.",
  },

  // ==== E-sign ====
  {
    key: "esign.basic",
    name: "Basic E-Signature",
    category: "esign",
    defaultState: "enabled",
    description: "Typed-name + timestamp + IP signature on quotes and check-in.",
    upgradeCopy: "Suitable for shop authorization workflows.",
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
    name: "Automation Templates",
    category: "automation",
    defaultState: "enabled",
    description: "Pre-built follow-ups, reminders, and status notifications.",
    upgradeCopy: "",
  },
  {
    key: "automation.advanced_builder",
    name: "Advanced Automation Builder",
    category: "automation",
    defaultState: "coming_soon",
    minimumTier: "pro",
    description: "Visual trigger + condition + action builder.",
    upgradeCopy: "Coming in a future release.",
  },

  // ==== Reporting / Reviews ====
  {
    key: "reporting.advanced",
    name: "Advanced Reporting",
    category: "reporting",
    defaultState: "coming_soon",
    minimumTier: "pro",
    description: "Cohort analysis, LTV, funnel drilldowns.",
    upgradeCopy: "Included with the Pro plan.",
  },
  {
    key: "reporting.review_analytics",
    name: "Review Analytics",
    category: "reporting",
    defaultState: "coming_soon",
    minimumTier: "pro",
    description: "Sentiment + response tracking across review platforms.",
    upgradeCopy: "Basic review-link redirects are available on every plan.",
  },

  // ==== Multi-location / operations ====
  {
    key: "operations.multi_location",
    name: "Multiple Locations",
    category: "operations",
    defaultState: "enabled",
    minimumTier: "pro",
    description: "Manage more than one physical shop location.",
    upgradeCopy: "Included with the Pro plan.",
  },
  {
    key: "operations.time_tracking",
    name: "Time Tracking",
    category: "operations",
    defaultState: "enabled",
    description: "Clock in/out per job or task.",
    upgradeCopy: "",
  },
  {
    key: "operations.warranties",
    name: "Warranties + Aftercare",
    category: "operations",
    defaultState: "enabled",
    description: "Auto-generated warranty records and aftercare instructions per service.",
    upgradeCopy: "",
  },
  {
    key: "operations.digital_inspections",
    name: "Digital Inspections",
    category: "operations",
    defaultState: "enabled",
    description: "Vehicle check-in condition reports with photos and signatures.",
    upgradeCopy: "",
  },
  {
    key: "operations.photo_annotation",
    name: "Photo Annotation",
    category: "operations",
    defaultState: "enabled",
    description: "Draw damage markers and notes directly on photos.",
    upgradeCopy: "",
  },

  // ==== Inventory ====
  {
    key: "inventory.rolls",
    name: "Roll Inventory",
    category: "inventory",
    defaultState: "enabled",
    description: "Track film rolls by width and remaining length.",
    upgradeCopy: "",
  },
  {
    key: "inventory.barcode",
    name: "Barcode Scanning",
    category: "inventory",
    defaultState: "coming_soon",
    description: "Scan rolls in and out with your phone camera.",
    upgradeCopy: "Coming soon.",
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
  starter: 0,
  pro: 1,
  enterprise: 2,
};
