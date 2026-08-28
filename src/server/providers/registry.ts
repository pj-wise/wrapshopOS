import "server-only";

import { cache } from "react";

import { env } from "@/env";
import { prisma } from "@/server/db";
import { defaultProviderFor, type IntegrationCapability } from "@/lib/integrations";
import { decrypt } from "@/server/security/encryption";

import type {
  AIProvider,
  AccountingProvider,
  AddressProvider,
  EmailProvider,
  MessagingProvider,
  PatternProvider,
  StorageProvider,
  VehicleDataProvider,
} from "./types";

import { createNhtsaProvider } from "./vehicle/nhtsa";
import { createSupabaseStorageProvider } from "./storage/supabase";
import { createResendProvider } from "./email/resend";
import { noopEmailProvider } from "./email/noop";
import { noopMessagingProvider } from "./messaging/noop";
import { noopAiProvider } from "./ai/noop";
import { noopAddressProvider } from "./address/noop";
import { noopPatternProvider } from "./pattern/noop";
import { createQuickBooksAccountingProvider } from "./accounting/quickbooks";

/**
 * Provider registry — resolves the correct implementation per (org, capability).
 *
 * Two resolution layers:
 *
 *   `resolveProviderConfig(orgId, capability)` returns the effective config
 *   for that capability with a well-defined fallback chain:
 *     1. Tenant row in `ExternalIntegration` (config JSON is decrypted per
 *        field, then merged over platform defaults).
 *     2. Platform env vars — the "hybrid" mode from the plan: shops without
 *        their own credentials fall through to WrapShop OS's account.
 *     3. Nothing wired → provider consumers apply a noop.
 *
 *   `get<Capability>Provider(orgId)` then hands that config to the concrete
 *   provider factory.
 *
 * Instances are cached per-request via React `cache()`. A cross-request cache
 * layer keyed on `${orgId}:${capability}:${updatedAt}` invalidates the
 * moment the tenant re-saves their config (the mutation bumps `updatedAt`).
 */

// ---------------------------------------------------------------------------
// Cross-request config cache
// ---------------------------------------------------------------------------

type CachedEntry = { value: ResolvedConfig; expiresAt: number };
const CROSS_REQ_TTL_MS = 5 * 60_000;
const crossReqCache = new Map<string, CachedEntry>();

export type ResolvedConfig = {
  provider: string;
  /** Merged (tenant over platform), decrypted config values. */
  config: Record<string, string | undefined>;
  source: "tenant" | "platform";
};

/**
 * Provider-specific mapping from platform env vars → the config keys the
 * factory expects. Adding a new tenant-configurable provider = add its
 * default entry here.
 */
function platformDefaultsFor(capability: IntegrationCapability): {
  provider: string | null;
  config: Record<string, string | undefined>;
} {
  const provider = defaultProviderFor(capability);
  switch (capability) {
    case "email":
      return {
        provider,
        config: {
          apiKey: env.RESEND_API_KEY,
          defaultFrom: env.EMAIL_FROM,
          webhookSecret: env.RESEND_WEBHOOK_SECRET,
        },
      };
    default:
      return { provider, config: {} };
  }
}

/**
 * Decrypt every string leaf of an `ExternalIntegration.config` blob. Fields
 * that fail to decrypt (bad ciphertext, missing key rotation, etc.) drop
 * out silently so the platform fallback kicks in for that field.
 */
function decryptConfigFields(raw: unknown): Record<string, string | undefined> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v !== "string") continue;
    try {
      out[k] = decrypt(v);
    } catch {
      // Silently drop unusable ciphertext; consumer will fall back to platform.
    }
  }
  return out;
}

export const resolveProviderConfig = cache(
  async (orgId: string, capability: IntegrationCapability): Promise<ResolvedConfig> => {
    const row = await prisma.externalIntegration.findFirst({
      where: { organizationId: orgId, capability, enabled: true },
      select: { provider: true, config: true, updatedAt: true },
    });
    const cacheKey = row
      ? `${orgId}:${capability}:${row.updatedAt.getTime()}`
      : `${orgId}:${capability}:platform`;
    const now = Date.now();
    const cached = crossReqCache.get(cacheKey);
    if (cached && cached.expiresAt > now) return cached.value;

    const platform = platformDefaultsFor(capability);
    let value: ResolvedConfig;
    if (row) {
      const tenantConfig = decryptConfigFields(row.config);
      // Tenant overrides win field-by-field; empty/undefined tenant values
      // fall through to the platform default so a shop can override just the
      // `from` address without re-pasting the API key.
      const merged: Record<string, string | undefined> = { ...platform.config };
      for (const [k, v] of Object.entries(tenantConfig)) {
        if (v != null && v !== "") merged[k] = v;
      }
      value = { provider: row.provider, config: merged, source: "tenant" };
    } else {
      value = {
        provider: platform.provider ?? "noop",
        config: platform.config,
        source: "platform",
      };
    }

    crossReqCache.set(cacheKey, { value, expiresAt: now + CROSS_REQ_TTL_MS });
    return value;
  },
);

/**
 * Testing hook: drop the whole cross-request cache. Used by the
 * `integrations.saveConfig` mutation to make new credentials effective
 * even if the same Node process handles a follow-up request within the
 * 5-minute TTL — otherwise, an in-flight tab could still see the old key.
 */
export function invalidateResolvedConfig(orgId?: string, capability?: IntegrationCapability): void {
  if (!orgId && !capability) {
    crossReqCache.clear();
    return;
  }
  for (const key of crossReqCache.keys()) {
    if (orgId && !key.startsWith(`${orgId}:`)) continue;
    if (capability && !key.includes(`:${capability}:`)) continue;
    crossReqCache.delete(key);
  }
}

// ---------------------------------------------------------------------------
// Public accessors — one per capability.
// ---------------------------------------------------------------------------

export const getVehicleProvider = cache(async (orgId: string): Promise<VehicleDataProvider> => {
  const resolved = await resolveProviderConfig(orgId, "vehicle_data");
  if (resolved.provider === "nhtsa" || resolved.provider === "noop") {
    return createNhtsaProvider();
  }
  throw new Error(`Unknown vehicle_data provider: ${resolved.provider}`);
});

export const getStorageProvider = cache(async (_orgId: string): Promise<StorageProvider> => {
  // Storage is per-platform, not per-org. Every org uses the same bucket,
  // segregated by path prefix `orgs/<orgId>/*`.
  return createSupabaseStorageProvider();
});

export const getEmailProvider = cache(async (orgId: string): Promise<EmailProvider> => {
  const resolved = await resolveProviderConfig(orgId, "email");
  if (resolved.provider === "resend" || resolved.provider === "noop") {
    const { apiKey, defaultFrom, webhookSecret } = resolved.config;
    if (apiKey && defaultFrom) {
      return createResendProvider({ apiKey, defaultFrom, webhookSecret });
    }
    return noopEmailProvider;
  }
  throw new Error(`Unknown email provider: ${resolved.provider}`);
});

export const getMessagingProvider = cache(async (_orgId: string): Promise<MessagingProvider> => {
  // No real messaging provider is enabled by default in MVP.
  // TODO(stretch:sms.send.real): resolve twilio / telnyx per-org integration.
  return noopMessagingProvider;
});

export const getAccountingProvider = cache(async (orgId: string): Promise<AccountingProvider> => {
  const conn = await prisma.accountingConnection.findFirst({
    where: { organizationId: orgId, provider: "quickbooks", status: "connected" },
    select: { id: true },
  });
  if (!conn) {
    throw new Error(
      "QuickBooks is not connected for this organization. Connect it from /admin/integrations.",
    );
  }
  return createQuickBooksAccountingProvider(orgId);
});

export async function isAccountingConnected(orgId: string): Promise<boolean> {
  const conn = await prisma.accountingConnection.findFirst({
    where: { organizationId: orgId, provider: "quickbooks", status: "connected" },
    select: { id: true },
  });
  return Boolean(conn);
}

export const getAiProvider = cache(async (_orgId: string): Promise<AIProvider> => {
  return noopAiProvider;
});

export const getAddressProvider = cache(async (_orgId: string): Promise<AddressProvider> => {
  return noopAddressProvider;
});

export const getPatternProvider = cache(async (_orgId: string): Promise<PatternProvider> => {
  return noopPatternProvider;
});
