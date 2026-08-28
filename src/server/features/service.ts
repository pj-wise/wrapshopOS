import "server-only";

import { cache } from "react";

import { env } from "@/env";
import { prisma } from "@/server/db";
import {
  FEATURES,
  type FeatureDef,
  type FeatureKey,
  type FeatureState,
  type SubscriptionTier,
  TIER_RANK,
  getFeature,
} from "@/lib/features";

export type ResolvedFeature = {
  key: FeatureKey;
  state: FeatureState;
  reason:
    | "default"
    | "override:user"
    | "override:org"
    | "override:location"
    | "subscription:below-tier"
    | "integration:missing";
  requiredIntegration?: string;
  minimumTier?: SubscriptionTier;
};

type ResolveArgs = {
  orgId: string;
  orgTier: SubscriptionTier;
  userId?: string | null;
  locationId?: string | null;
};

/**
 * FeatureService — resolves a feature's effective state for a given
 * (org, user, location) tuple. Uses React `cache()` so a single request
 * shares one resolution snapshot across server components + procedures.
 */
export const featureService = {
  resolveAll: cache(async (args: ResolveArgs): Promise<Record<FeatureKey, ResolvedFeature>> => {
    // Load all overrides that could apply. Build the scope-match OR
    // dynamically so we don't need a "never match" sentinel — a stray
    // non-UUID string in the id filter fails Prisma's column-level UUID
    // parser at query time.
    const scopeMatches: Array<Record<string, unknown>> = [
      { scope: "org", scopeId: null },
    ];
    if (args.locationId) {
      scopeMatches.push({ scope: "location", scopeId: args.locationId });
    }
    if (args.userId) {
      scopeMatches.push({ scope: "user", userId: args.userId });
    }
    const overrides = await prisma.featureOverride.findMany({
      where: {
        organizationId: args.orgId,
        OR: scopeMatches as never,
        AND: [
          {
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } },
            ],
          },
        ],
      },
    });

    // Bucket overrides by featureKey → { user?, org?, location? }
    type Bucket = {
      user?: FeatureState;
      org?: FeatureState;
      location?: FeatureState;
    };
    const byKey = new Map<string, Bucket>();
    for (const o of overrides) {
      const b = byKey.get(o.featureKey) ?? {};
      if (o.scope === "user") b.user = o.state as FeatureState;
      else if (o.scope === "org") b.org = o.state as FeatureState;
      else if (o.scope === "location") b.location = o.state as FeatureState;
      byKey.set(o.featureKey, b);
    }

    // Live integration availability (does the org have this capability wired?)
    //
    // The set covers three cases:
    //   1. Per-tenant `ExternalIntegration` row (Resend override, future Twilio).
    //   2. Platform-env fallbacks — e.g. `RESEND_API_KEY` in `.env` counts as
    //      "email is wired" even without a per-tenant row (hybrid mode).
    //   3. Zero-config capabilities that are always available (NHTSA, Supabase
    //      Storage) — these providers work without any credentials or config.
    const integrations = await prisma.externalIntegration.findMany({
      where: { organizationId: args.orgId, enabled: true },
      select: { capability: true, status: true },
    });
    const wiredCapabilities = new Set<string>(
      integrations
        .filter((i) => i.status !== "unauthorized")
        .map((i) => i.capability),
    );
    if (env.RESEND_API_KEY && env.EMAIL_FROM) wiredCapabilities.add("email");
    wiredCapabilities.add("vehicle_data");
    wiredCapabilities.add("storage");

    // QuickBooks tokens live in AccountingConnection, not ExternalIntegration,
    // so its presence has to be checked separately. Without this, every
    // accounting.* flag stays "requires_integration" even after a successful
    // OAuth and the invoices UI stays greyed out.
    const accounting = await prisma.accountingConnection.findFirst({
      where: {
        organizationId: args.orgId,
        provider: "quickbooks",
        status: "connected",
      },
      select: { id: true },
    });
    if (accounting) wiredCapabilities.add("accounting");

    const out = {} as Record<FeatureKey, ResolvedFeature>;
    for (const def of FEATURES) {
      out[def.key] = resolveOne(def, byKey.get(def.key), args.orgTier, wiredCapabilities);
    }
    return out;
  }),

  async resolve(args: ResolveArgs, key: FeatureKey): Promise<ResolvedFeature> {
    const all = await featureService.resolveAll(args);
    return all[key];
  },

  async isEnabled(args: ResolveArgs, key: FeatureKey): Promise<boolean> {
    const r = await featureService.resolve(args, key);
    return r.state === "enabled" || r.state === "beta";
  },

  async require(args: ResolveArgs, key: FeatureKey): Promise<void> {
    const r = await featureService.resolve(args, key);
    if (r.state !== "enabled" && r.state !== "beta") {
      throw new FeatureUnavailableError(key, r);
    }
  },
};

export class FeatureUnavailableError extends Error {
  constructor(
    public readonly featureKey: FeatureKey,
    public readonly resolved: ResolvedFeature,
  ) {
    super(`Feature "${featureKey}" is not available (${resolved.state}, ${resolved.reason})`);
    this.name = "FeatureUnavailableError";
  }
}

function resolveOne(
  def: FeatureDef,
  overrides: { user?: FeatureState; org?: FeatureState; location?: FeatureState } | undefined,
  orgTier: SubscriptionTier,
  wiredCapabilities: Set<string>,
): ResolvedFeature {
  if (overrides?.user !== undefined) {
    return { key: def.key as FeatureKey, state: overrides.user, reason: "override:user" };
  }
  if (overrides?.org !== undefined) {
    return { key: def.key as FeatureKey, state: overrides.org, reason: "override:org" };
  }
  if (overrides?.location !== undefined) {
    return { key: def.key as FeatureKey, state: overrides.location, reason: "override:location" };
  }
  if (def.minimumTier && TIER_RANK[orgTier] < TIER_RANK[def.minimumTier]) {
    return {
      key: def.key as FeatureKey,
      state: "requires_subscription",
      reason: "subscription:below-tier",
      minimumTier: def.minimumTier,
    };
  }
  if (def.requiresIntegration) {
    const wired = wiredCapabilities.has(def.requiresIntegration);
    if (!wired && def.defaultState === "enabled") {
      // Degrade: default said enabled but nobody wired the capability.
      return {
        key: def.key as FeatureKey,
        state: "requires_integration",
        reason: "integration:missing",
        requiredIntegration: def.requiresIntegration,
      };
    }
    if (wired && def.defaultState === "requires_integration") {
      // Upgrade: catalog says "off until wired" and the org has wired it.
      // Without this the flag never flips on for e.g. messaging.sms after a
      // shop connects Twilio.
      return { key: def.key as FeatureKey, state: "enabled", reason: "default" };
    }
  }
  return { key: def.key as FeatureKey, state: def.defaultState, reason: "default" };
}

export { getFeature };
