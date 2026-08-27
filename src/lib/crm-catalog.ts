/**
 * Static catalogs for lead pipeline + customer types. Sources of truth for
 * form pickers, filters, and future analytics buckets. Every value is a
 * stable string so DB rows can be filtered by exact match.
 */

export const LEAD_SOURCES = [
  { key: "website", label: "Website" },
  { key: "phone", label: "Phone" },
  { key: "walk_in", label: "Walk-in" },
  { key: "instagram", label: "Instagram" },
  { key: "facebook", label: "Facebook" },
  { key: "google", label: "Google" },
  { key: "referral", label: "Referral" },
  { key: "existing_customer", label: "Existing customer" },
  { key: "dealer", label: "Dealer" },
  { key: "fleet", label: "Fleet" },
  { key: "other", label: "Other" },
] as const;

export type LeadSourceKey = (typeof LEAD_SOURCES)[number]["key"];
export const LEAD_SOURCE_KEYS = LEAD_SOURCES.map((s) => s.key);

export const LEAD_STAGES = [
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "waiting", label: "Waiting for customer" },
  { key: "estimate_requested", label: "Estimate requested" },
  { key: "quote_sent", label: "Quote sent" },
  { key: "quote_viewed", label: "Quote viewed" },
  { key: "follow_up", label: "Follow-up" },
  { key: "approved", label: "Approved" },
  { key: "scheduled", label: "Scheduled" },
  { key: "converted", label: "Converted" },
  { key: "lost", label: "Lost" },
] as const;

export type LeadStageKey = (typeof LEAD_STAGES)[number]["key"];
export const LEAD_STAGE_KEYS = LEAD_STAGES.map((s) => s.key);

export const PREFERRED_CONTACT = [
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "sms", label: "Text" },
] as const;

export type PreferredContactKey = (typeof PREFERRED_CONTACT)[number]["key"];

export const CUSTOMER_TYPES = [
  { key: "individual", label: "Individual" },
  { key: "business", label: "Business" },
] as const;

export type CustomerTypeKey = (typeof CUSTOMER_TYPES)[number]["key"];

export function leadSourceLabel(key: string): string {
  return LEAD_SOURCES.find((s) => s.key === key)?.label ?? key;
}

export function leadStageLabel(key: string): string {
  return LEAD_STAGES.find((s) => s.key === key)?.label ?? key;
}
