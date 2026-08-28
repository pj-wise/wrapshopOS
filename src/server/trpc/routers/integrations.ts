import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  INTEGRATIONS,
  getIntegration,
  type IntegrationCapability,
  type IntegrationConfigField,
  type IntegrationId,
} from "@/lib/integrations";
import { encrypt } from "@/server/security/encryption";
import {
  createTRPCRouter,
  orgProcedure,
  requirePermission,
} from "../init";
import {
  invalidateResolvedConfig,
  resolveProviderConfig,
} from "@/server/providers/registry";
import { createResendProvider } from "@/server/providers/email/resend";

/**
 * Per-tenant integration management. The rendering rules:
 *   - Fields are driven by `configFields` in `src/lib/integrations.ts`.
 *   - Secrets are only ever written from client → server; the "current"
 *     value is never sent back down (server returns just a boolean flag
 *     saying whether the tenant has an override in place).
 *   - Save/reset both bump `updatedAt` on the underlying row, which is
 *     part of the registry's cross-request cache key. A follow-up call to
 *     `invalidateResolvedConfig` also clears the current process's cache
 *     so the change is instant, not TTL-bounded.
 */

const INTEGRATION_IDS = INTEGRATIONS.map((i) => i.id) as [
  IntegrationId,
  ...IntegrationId[],
];

const saveConfigInput = z.object({
  provider: z.enum(INTEGRATION_IDS),
  /**
   * Only fields the user actually touched. Anything omitted keeps its
   * existing ciphertext; that lets us re-save one field without forcing
   * the user to re-paste secrets we already have.
   */
  fields: z.record(z.string(), z.string()).default({}),
});

const testConnectionInput = z.object({
  provider: z.enum(INTEGRATION_IDS),
  /**
   * Optional. When present, we test with these values; when absent we
   * test with whatever the resolver currently returns (tenant OR
   * platform fallback). Useful for the "Test connection" button before
   * a save.
   */
  fields: z.record(z.string(), z.string()).optional(),
});

function integrationOrThrow(id: IntegrationId) {
  const def = getIntegration(id);
  if (!def.configFields || def.configFields.length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `${def.name} does not support per-tenant configuration via this dialog.`,
    });
  }
  return def;
}

/** Reject empty strings + fields not declared on the integration def. */
function narrowFields(
  submitted: Record<string, string>,
  configFields: readonly IntegrationConfigField[],
): Record<string, string> {
  const allow = new Set(configFields.map((f) => f.key));
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(submitted)) {
    if (!allow.has(k)) continue;
    const trimmed = v.trim();
    if (trimmed.length === 0) continue;
    out[k] = trimmed;
  }
  return out;
}

async function runHealthCheck(
  providerId: IntegrationId,
  config: Record<string, string | undefined>,
): Promise<{ ok: boolean; message?: string }> {
  if (providerId === "resend") {
    const { apiKey, defaultFrom } = config;
    if (!apiKey || !defaultFrom) {
      return {
        ok: false,
        message:
          "Missing API key or From address — provide both, or leave both blank to fall back to the platform default.",
      };
    }
    const provider = createResendProvider({ apiKey, defaultFrom });
    const res = await provider.healthCheck?.();
    return { ok: !!res?.ok, message: res?.message };
  }
  return {
    ok: false,
    message: `Health check not implemented for provider "${providerId}".`,
  };
}

export const integrationsRouter = createTRPCRouter({
  /**
   * List of provider defs the current org has configured overrides for,
   * plus per-field indicators of whether the override is currently
   * populated. Client uses this to render "Connected" pills without
   * ever having to see the actual secret.
   */
  listOverrides: orgProcedure
    .use(requirePermission("admin:integrations"))
    .query(async ({ ctx }) => {
      const rows = await ctx.db.externalIntegration.findMany({
        where: { organizationId: ctx.session.organizationId },
        select: {
          provider: true,
          capability: true,
          status: true,
          config: true,
          updatedAt: true,
        },
      });
      return rows.map((r) => {
        const raw = (r.config ?? {}) as Record<string, unknown>;
        const populatedFields = Object.entries(raw)
          .filter(([, v]) => typeof v === "string" && v.length > 0)
          .map(([k]) => k);
        return {
          provider: r.provider,
          capability: r.capability,
          status: r.status,
          populatedFields,
          updatedAt: r.updatedAt,
        };
      });
    }),

  /**
   * Encrypt every submitted field and upsert the row for
   * (organizationId, capability, provider). Fields the user left blank
   * are dropped — the merged resolver falls back to the platform value.
   */
  saveConfig: orgProcedure
    .use(requirePermission("admin:integrations"))
    .meta({ audit: { entity: "external_integration", action: "save_config" } })
    .input(saveConfigInput)
    .mutation(async ({ ctx, input }) => {
      const def = integrationOrThrow(input.provider as IntegrationId);
      const fields = narrowFields(input.fields, def.configFields!);

      // Merge with any existing ciphertext so partial saves don't erase
      // fields the user chose not to re-paste.
      const existing = await ctx.db.externalIntegration.findFirst({
        where: {
          organizationId: ctx.session.organizationId,
          capability: def.capability,
          provider: def.id,
        },
        select: { id: true, config: true },
      });
      const existingConfig = (existing?.config ?? {}) as Record<string, unknown>;
      const nextConfig: Record<string, string> = {};
      for (const [k, v] of Object.entries(existingConfig)) {
        if (typeof v === "string") nextConfig[k] = v; // keep ciphertext
      }
      for (const [k, v] of Object.entries(fields)) {
        nextConfig[k] = encrypt(v); // overwrite with fresh ciphertext
      }

      await ctx.db.externalIntegration.upsert({
        where: {
          organizationId_capability_provider: {
            organizationId: ctx.session.organizationId,
            capability: def.capability,
            provider: def.id,
          },
        },
        create: {
          organizationId: ctx.session.organizationId,
          capability: def.capability,
          provider: def.id,
          enabled: true,
          config: nextConfig,
          status: "healthy",
        },
        update: {
          enabled: true,
          config: nextConfig,
        },
      });

      invalidateResolvedConfig(
        ctx.session.organizationId,
        def.capability as IntegrationCapability,
      );
      return { ok: true };
    }),

  /**
   * Run the provider's `.healthCheck()` with the supplied fields (falls
   * back to the currently-resolved config if omitted). Doesn't persist.
   */
  testConnection: orgProcedure
    .use(requirePermission("admin:integrations"))
    .input(testConnectionInput)
    .mutation(async ({ ctx, input }) => {
      const def = integrationOrThrow(input.provider as IntegrationId);
      let config: Record<string, string | undefined>;
      if (input.fields) {
        const narrowed = narrowFields(input.fields, def.configFields!);
        // Layer over the currently-resolved config so a partial submission
        // (e.g. only apiKey, keep existing from) still tests correctly.
        const current = await resolveProviderConfig(
          ctx.session.organizationId,
          def.capability as IntegrationCapability,
        );
        config = { ...current.config, ...narrowed };
      } else {
        const resolved = await resolveProviderConfig(
          ctx.session.organizationId,
          def.capability as IntegrationCapability,
        );
        config = resolved.config;
      }
      const result = await runHealthCheck(def.id as IntegrationId, config);
      return result;
    }),

  /**
   * Delete the org's ExternalIntegration row entirely — the registry
   * falls back to the platform's env-based defaults on the next resolve.
   */
  revertToDefault: orgProcedure
    .use(requirePermission("admin:integrations"))
    .meta({ audit: { entity: "external_integration", action: "revert" } })
    .input(z.object({ provider: z.enum(INTEGRATION_IDS) }))
    .mutation(async ({ ctx, input }) => {
      const def = integrationOrThrow(input.provider as IntegrationId);
      await ctx.db.externalIntegration.deleteMany({
        where: {
          organizationId: ctx.session.organizationId,
          capability: def.capability,
          provider: def.id,
        },
      });
      invalidateResolvedConfig(
        ctx.session.organizationId,
        def.capability as IntegrationCapability,
      );
      return { ok: true };
    }),
});
