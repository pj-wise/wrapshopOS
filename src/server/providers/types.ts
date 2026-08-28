import "server-only";

/**
 * Shared provider types. Every capability interface follows the same shape:
 *   - `name`: static identifier matching INTEGRATIONS[].id
 *   - `capabilities`: string[] declaring which sub-features are supported
 *   - `healthCheck?()`: optional connectivity probe called by Inngest cron
 */

export type ProviderHealth = {
  ok: boolean;
  latencyMs?: number;
  message?: string;
  checkedAt: string; // ISO
};

export type ProviderBase = {
  readonly name: string;
  healthCheck?(): Promise<ProviderHealth>;
};

// ============================================================================
// Vehicle data
// ============================================================================

export type VehicleCapability =
  | "vin_decode"
  | "advanced_specs"
  | "plate_lookup"
  | "vehicle_images";

export type VehicleDecodeResult = {
  vin: string;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  bodyClass: string | null;
  vehicleType: string | null;
  manufacturer: string | null;
  engine: string | null;
  fuelType: string | null;
  plantCountry: string | null;
  errors: string[]; // decode warnings
  raw: Record<string, unknown>; // full provider payload
  providerName: string;
  decodedAt: string;
};

export type PlateLookupResult = {
  vin: string | null;
  matchConfidence: "high" | "medium" | "low" | null;
  raw: unknown;
};

export type VehicleImage = {
  url: string;
  angle: "front" | "rear" | "side" | "three_quarter" | "interior" | "other";
  width?: number;
  height?: number;
  credit?: string;
};

export interface VehicleDataProvider extends ProviderBase {
  readonly capabilities: readonly VehicleCapability[];
  decodeVin(vin: string): Promise<VehicleDecodeResult>;
  /** Return distinct model names for a (year, make) — powers cascading pickers. */
  getModels?(year: number, make: string): Promise<string[]>;
  lookupPlate?(plate: string, state: string): Promise<PlateLookupResult>;
  getVehicleImages?(year: number, make: string, model: string, trim?: string): Promise<VehicleImage[]>;
}

// ============================================================================
// Email
// ============================================================================

export type EmailAttachment = {
  filename: string;
  contentType: string;
  content: string | Buffer; // base64 string or buffer
};

export type SendEmailInput = {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  from?: string; // defaults to EMAIL_FROM
  replyTo?: string;
  subject: string;
  html?: string;
  text?: string;
  attachments?: EmailAttachment[];
  headers?: Record<string, string>;
  tags?: Record<string, string>;
};

export type SendEmailResult = {
  ok: boolean;
  messageId: string | null;
  provider: string;
  error?: string;
};

export interface EmailProvider extends ProviderBase {
  send(input: SendEmailInput): Promise<SendEmailResult>;
}

// ============================================================================
// Messaging (SMS / MMS)
// ============================================================================

export type SendMessageInput = {
  to: string; // E.164
  from?: string;
  body: string;
  mediaUrls?: string[]; // MMS
};

export type SendMessageResult = {
  ok: boolean;
  messageId: string | null;
  provider: string;
  status: "queued" | "sent" | "failed";
  error?: string;
};

export interface MessagingProvider extends ProviderBase {
  supportsSms: boolean;
  supportsMms: boolean;
  send(input: SendMessageInput): Promise<SendMessageResult>;
}

// ============================================================================
// Accounting
// ============================================================================

export type AccountingCustomer = {
  externalId: string; // provider-side ID
  displayName: string;
  email?: string;
  phone?: string;
};

export type AccountingLineItem = {
  description: string;
  quantity: number;
  unitPriceCents: number;
  itemExternalId?: string;
  taxable?: boolean;
};

export type AccountingInvoice = {
  externalId: string;
  status: "draft" | "sent" | "viewed" | "partial" | "paid" | "void";
  totalCents: number;
  balanceCents: number;
  payLinkUrl?: string;
};

export type AccountingPayment = {
  externalId: string;
  amountCents: number;
  /** ISO date (YYYY-MM-DD or full ISO) reported by the provider. */
  txnDate?: string;
  customerExternalId?: string;
  /** External IDs of the invoices this payment was applied to. */
  linkedInvoiceExternalIds: string[];
  /** Free-form label — e.g. QBO PaymentMethodRef.name. */
  method?: string;
};

export interface AccountingProvider extends ProviderBase {
  syncCustomer(input: { localId: string; displayName: string; email?: string; phone?: string; externalId?: string }): Promise<AccountingCustomer>;
  createInvoice(input: {
    customerExternalId: string;
    number: string;
    lines: AccountingLineItem[];
    dueDate?: string;
    memo?: string;
    allowOnlinePayment?: boolean;
  }): Promise<AccountingInvoice>;
  getInvoice(externalId: string): Promise<AccountingInvoice | null>;
  getPayment(externalId: string): Promise<AccountingPayment | null>;
  reconcilePayments(sinceIso: string): Promise<Array<{ invoiceExternalId: string; amountCents: number; receivedAt: string; externalPaymentId: string }>>;
}

// ============================================================================
// Storage
// ============================================================================

export type SignedUploadUrl = {
  url: string;
  method: "PUT" | "POST";
  fields?: Record<string, string>;
  storagePath: string;
  expiresAt: string;
};

export type SignedDownloadUrl = {
  url: string;
  expiresAt: string;
};

export interface StorageProvider extends ProviderBase {
  createUploadUrl(input: {
    orgId: string;
    category: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
  }): Promise<SignedUploadUrl>;
  createDownloadUrl(storagePath: string, ttlSeconds?: number): Promise<SignedDownloadUrl>;
  delete(storagePath: string): Promise<void>;
  read(storagePath: string): Promise<ArrayBuffer>;
  put(storagePath: string, body: ArrayBuffer | Uint8Array, mimeType: string): Promise<void>;
}

// ============================================================================
// Address
// ============================================================================

export type AddressSuggestion = {
  formatted: string;
  line1: string;
  line2?: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  providerRef?: string;
};

export interface AddressProvider extends ProviderBase {
  autocomplete(query: string): Promise<AddressSuggestion[]>;
  resolve(providerRef: string): Promise<AddressSuggestion | null>;
}

// ============================================================================
// AI
// ============================================================================

export type AiMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export interface AIProvider extends ProviderBase {
  generate(input: { messages: AiMessage[]; maxTokens?: number; temperature?: number }): Promise<{ text: string; provider: string }>;
  summarize?(input: { text: string; maxTokens?: number }): Promise<{ text: string }>;
  analyzeImage?(input: { imageUrl: string; prompt: string }): Promise<{ text: string }>;
}

// ============================================================================
// PPF pattern / plotter
// ============================================================================

export interface PatternProvider extends ProviderBase {
  listAvailablePatterns(input: { year: number; make: string; model: string; trim?: string }): Promise<Array<{ id: string; label: string; panelCoverage: string[]; materialSqft: number }>>;
  requestCutFile(input: { patternId: string; materialWidthIn: number }): Promise<{ cutFileUrl: string; providerJobId: string }>;
}

// ============================================================================
// PDF
// ============================================================================

export type RenderPdfInput = {
  template: "quote" | "invoice" | "work_order" | "warranty" | "inspection" | "job_summary";
  data: unknown; // template-specific payload
  branding: { orgName: string; logoUrl?: string; primaryColor?: string };
};

export interface PdfProvider extends ProviderBase {
  render(input: RenderPdfInput): Promise<{ bytes: Uint8Array; mimeType: "application/pdf" }>;
}
