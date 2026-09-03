/**
 * External dependency registry — static metadata for every third-party integration.
 *
 * The /admin/integrations page renders from this catalog, joined with per-org
 * ExternalIntegration rows for live connection status.
 *
 * Adding a new provider = add a definition here + implement the provider
 * interface under src/server/providers/<capability>/.
 */

import type { FeatureKey } from "./features";

export type IntegrationCapability =
  | "vehicle_data"
  | "email"
  | "messaging"
  | "accounting"
  | "storage"
  | "address"
  | "ai"
  | "pattern"
  | "pdf"
  | "calendar";

export type IntegrationCostType =
  | "free"
  | "freemium"
  | "usage_based"
  | "subscription"
  | "licensed_data"
  | "unknown";

export type IntegrationAuthType = "none" | "api_key" | "oauth2" | "webhook_secret";

/**
 * Declarative shape of a per-tenant config field. Powers the generic
 * `<IntegrationConfigDialog>` — pick a `type` and the dialog renders the
 * right input, sets sensible defaults, and shows the value that comes from
 * the platform fallback as a placeholder when the tenant hasn't overridden.
 */
export type IntegrationConfigField = {
  key: string;
  label: string;
  /**
   * `secret` uses a password input + never echoes existing values back to
   * the client (the server stores the ciphertext but the "current value"
   * shown to Owners is always `••••••`).
   */
  type: "secret" | "text" | "email";
  placeholder?: string;
  required?: boolean;
  description?: string;
};

export type IntegrationDef = {
  id: string; // slug used in ExternalIntegration.provider
  name: string;
  capability: IntegrationCapability;
  vendor: string;
  costType: IntegrationCostType;
  authType: IntegrationAuthType;
  enablesFeatures: FeatureKey[];
  requiredEnv?: string[]; // env vars needed (server-only)
  /**
   * Fields shops paste in Admin → Integrations to override the platform's
   * fallback. Absence of `configFields` means the provider isn't
   * tenant-configurable via the generic dialog (e.g. QBO uses OAuth,
   * Supabase Storage is platform-only).
   */
  configFields?: readonly IntegrationConfigField[];
  docsUrl: string;
  description: string;
  supportsHealthCheck: boolean;
  mvpDefault?: boolean; // this is the default provider bundled with MVP
};

export const INTEGRATIONS = [
  // ==== Vehicle data ====
  {
    id: "nhtsa",
    name: "NHTSA vPIC",
    capability: "vehicle_data",
    vendor: "National Highway Traffic Safety Administration",
    costType: "free",
    authType: "none",
    enablesFeatures: ["vehicle.vin_decoding"],
    docsUrl: "https://vpic.nhtsa.dot.gov/api/",
    description:
      "Official U.S. government VIN-decoding API. Covers year, make, model, body type, and factory-encoded engine info. Free, no auth, high uptime.",
    supportsHealthCheck: true,
    mvpDefault: true,
  },

  // ==== Email ====
  {
    id: "resend",
    name: "Resend",
    capability: "email",
    vendor: "Resend",
    costType: "freemium",
    authType: "api_key",
    enablesFeatures: ["messaging.email"],
    requiredEnv: ["RESEND_API_KEY"],
    configFields: [
      {
        key: "apiKey",
        label: "Resend API key",
        type: "secret",
        required: true,
        placeholder: "re_…",
        description:
          "Paste an API key from your Resend dashboard → API Keys. Leave blank to use the platform default.",
      },
      {
        key: "defaultFrom",
        label: "From address",
        type: "email",
        required: true,
        placeholder: "quotes@your-domain.com",
        description:
          "Must be a verified sender on your Resend account. Shows up on outbound emails.",
      },
    ],
    docsUrl: "https://resend.com/docs",
    description:
      "Transactional email with excellent developer experience. Handles quote emails, magic links, receipts, reminders.",
    supportsHealthCheck: true,
    mvpDefault: true,
  },

  // ==== Storage ====
  {
    id: "supabase_storage",
    name: "Supabase Storage",
    capability: "storage",
    vendor: "Supabase",
    costType: "subscription",
    authType: "api_key",
    enablesFeatures: [],
    requiredEnv: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
    docsUrl: "https://supabase.com/docs/guides/storage",
    description:
      "S3-compatible object storage bundled with Supabase. Signed upload/download URLs; per-org bucket paths.",
    supportsHealthCheck: true,
    mvpDefault: true,
  },

  // ==== Accounting ====
  {
    id: "quickbooks",
    name: "QuickBooks Online",
    capability: "accounting",
    vendor: "Intuit",
    costType: "subscription",
    authType: "oauth2",
    enablesFeatures: [
      "accounting.quickbooks",
      "accounting.invoice_sync",
      "accounting.payments",
      "accounting.online_payment_links",
    ],
    requiredEnv: ["QBO_CLIENT_ID", "QBO_CLIENT_SECRET", "QBO_WEBHOOK_VERIFIER", "QBO_ENVIRONMENT"],
    docsUrl: "https://developer.intuit.com/app/developer/qbo/docs/get-started",
    description:
      "Sync customers, invoices, and payments with QuickBooks Online. Route customers to QuickBooks-hosted payment experiences.",
    supportsHealthCheck: true,
    mvpDefault: true,
  },

  // ==== Messaging ====
  {
    id: "twilio",
    name: "Twilio",
    capability: "messaging",
    vendor: "Twilio",
    costType: "usage_based",
    authType: "api_key",
    enablesFeatures: ["messaging.sms", "messaging.mms"],
    requiredEnv: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_MESSAGING_SERVICE_SID"],
    configFields: [
      {
        key: "accountSid",
        label: "Account SID",
        type: "secret",
        required: true,
        placeholder: "AC…",
        description:
          "From console.twilio.com → Account → API keys & tokens. Starts with AC.",
      },
      {
        key: "authToken",
        label: "Auth Token",
        type: "secret",
        required: true,
        placeholder: "••••",
        description:
          "Same page as the Account SID. Never shown after save — paste again to rotate.",
      },
      {
        key: "messagingServiceSid",
        label: "Messaging Service SID",
        type: "secret",
        required: true,
        placeholder: "MG…",
        description:
          "Recommended over a raw From number — handles sender-pool routing + A2P 10DLC compliance. Starts with MG.",
      },
    ],
    docsUrl: "https://www.twilio.com/docs",
    description:
      "SMS + MMS. A2P 10DLC compliance required. Requires per-shop or platform-provisioned number.",
    supportsHealthCheck: true,
  },
  {
    id: "telnyx",
    name: "Telnyx",
    capability: "messaging",
    vendor: "Telnyx",
    costType: "usage_based",
    authType: "api_key",
    enablesFeatures: ["messaging.sms", "messaging.mms"],
    requiredEnv: ["TELNYX_API_KEY", "TELNYX_MESSAGING_PROFILE_ID"],
    docsUrl: "https://developers.telnyx.com/",
    description: "Alternative SMS/MMS provider — often more attractive pricing.",
    supportsHealthCheck: true,
  },

  // ==== Address (post-MVP) ====
  {
    id: "google_places",
    name: "Google Places",
    capability: "address",
    vendor: "Google",
    costType: "freemium",
    authType: "api_key",
    enablesFeatures: [
      "location.address_autocomplete",
      "location.maps",
      "location.route_distance",
    ],
    requiredEnv: ["GOOGLE_MAPS_API_KEY"],
    docsUrl: "https://developers.google.com/maps/documentation/places/web-service",
    description: "Autocomplete + maps + routing. Monthly free usage tier.",
    supportsHealthCheck: false,
  },

  // ==== AI (post-MVP) ====
  {
    id: "anthropic",
    name: "Anthropic Claude",
    capability: "ai",
    vendor: "Anthropic",
    costType: "usage_based",
    authType: "api_key",
    enablesFeatures: [
      "ai.assistant",
      "ai.message_drafting",
      "ai.message_summarization",
      "ai.photo_analysis",
      "ai.analytics",
      "ai.quote_recommendations",
    ],
    requiredEnv: ["ANTHROPIC_API_KEY"],
    docsUrl: "https://docs.anthropic.com/",
    description:
      "Claude models. Vision-capable. Preferred for reasoning and long-context summarization.",
    supportsHealthCheck: true,
  },

  // ==== Pattern / plotter (post-MVP; bridges to ntense-cut) ====
  {
    id: "ntense_cut",
    name: "ntense-cut (internal)",
    capability: "pattern",
    vendor: "PJ Wise",
    costType: "unknown",
    authType: "api_key",
    enablesFeatures: ["visualizer.ppf_pattern_integration"],
    requiredEnv: ["NTENSE_CUT_ENDPOINT", "NTENSE_CUT_API_KEY"],
    docsUrl: "",
    description:
      "Internal integration with the ntense-cut plotter for PPF pattern lookup + cut queue.",
    supportsHealthCheck: true,
  },
] as const satisfies readonly IntegrationDef[];

export type IntegrationId = (typeof INTEGRATIONS)[number]["id"];

export function getIntegration(id: IntegrationId): IntegrationDef {
  const integration = INTEGRATIONS.find((i) => i.id === id);
  if (!integration) throw new Error(`Unknown integration: ${id}`);
  return integration;
}

export function integrationsForCapability(
  capability: IntegrationCapability,
): IntegrationDef[] {
  return INTEGRATIONS.filter((i) => i.capability === capability);
}

export function defaultProviderFor(capability: IntegrationCapability): IntegrationId | null {
  const found = INTEGRATIONS.find(
    (i) => i.capability === capability && "mvpDefault" in i && i.mvpDefault === true,
  );
  return found?.id ?? null;
}
