import "server-only";

import { cache } from "react";

import { env } from "@/env";
import { prisma } from "@/server/db";
import { defaultProviderFor, type IntegrationCapability } from "@/lib/integrations";

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
 * Resolution:
 *   1. Look up ExternalIntegration for (org, capability, enabled=true).
 *   2. If found, instantiate the concrete provider (potentially using
 *      per-org config like OAuth tokens).
 *   3. Otherwise fall back to the platform default (from INTEGRATIONS[].mvpDefault)
 *      if env is configured, else a noop that stays inert.
 *
 * Provider instances are cached per-request via React `cache()` so multiple
 * resolves in the same request hit the same instance (matters for stateful
 * clients like Supabase auth or QBO OAuth).
 *
 * TODO(stretch): when we start using OAuth-configured providers, add per-org
 * memoization keyed by (orgId, capability, config.updatedAt) so a token
 * refresh invalidates the cached client.
 */

type ResolvedIntegration = {
  provider: string;
  config: unknown;
} | null;

const resolveIntegration = cache(async (orgId: string, capability: IntegrationCapability): Promise<ResolvedIntegration> => {
  const row = await prisma.externalIntegration.findFirst({
    where: { organizationId: orgId, capability, enabled: true },
    select: { provider: true, config: true },
  });
  return row ? { provider: row.provider, config: row.config } : null;
});

// ---------------------------------------------------------------------------
// Public accessors — one per capability.
// ---------------------------------------------------------------------------

export const getVehicleProvider = cache(async (orgId: string): Promise<VehicleDataProvider> => {
  const wired = await resolveIntegration(orgId, "vehicle_data");
  const providerId = wired?.provider ?? defaultProviderFor("vehicle_data");
  if (providerId === "nhtsa" || providerId == null) return createNhtsaProvider();
  throw new Error(`Unknown vehicle_data provider: ${providerId}`);
});

export const getStorageProvider = cache(async (_orgId: string): Promise<StorageProvider> => {
  // Storage is per-platform, not per-org. Every org uses the same bucket,
  // segregated by path prefix `orgs/<orgId>/*`.
  return createSupabaseStorageProvider();
});

export const getEmailProvider = cache(async (orgId: string): Promise<EmailProvider> => {
  const wired = await resolveIntegration(orgId, "email");
  const providerId = wired?.provider ?? defaultProviderFor("email");
  if (providerId === "resend" || providerId == null) {
    if (env.RESEND_API_KEY && env.EMAIL_FROM) {
      return createResendProvider(env.RESEND_API_KEY, env.EMAIL_FROM);
    }
    return noopEmailProvider;
  }
  throw new Error(`Unknown email provider: ${providerId}`);
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
