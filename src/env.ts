/**
 * Runtime-validated env config. Fails to boot if required vars are missing.
 * Import only from server code for `server`; client code may import `client`.
 */

import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

    // Supabase
    DATABASE_URL: z.string().url(),
    DIRECT_URL: z.string().url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),

    // Encryption for OAuth tokens stored in ExternalIntegration.config
    ENCRYPTION_KEY: z.string().min(32),

    // Email (Resend)
    RESEND_API_KEY: z.string().min(1).optional(),
    RESEND_WEBHOOK_SECRET: z.string().min(1).optional(),
    EMAIL_FROM: z.string().email().optional(),

    // QuickBooks Online
    QBO_CLIENT_ID: z.string().min(1).optional(),
    QBO_CLIENT_SECRET: z.string().min(1).optional(),
    QBO_WEBHOOK_VERIFIER: z.string().min(1).optional(),
    QBO_ENVIRONMENT: z.enum(["sandbox", "production"]).default("sandbox").optional(),

    // Inngest
    INNGEST_EVENT_KEY: z.string().min(1).optional(),
    INNGEST_SIGNING_KEY: z.string().min(1).optional(),

    // Sentry (optional; only server-side DSN)
    SENTRY_DSN: z.string().url().optional(),

    // Platform admin emails — comma-separated list. Users whose Supabase
    // Auth email matches (case-insensitive) get cross-org superpowers:
    // list/switch/edit any org's tier + integrations. Not a role in the
    // org RBAC catalog — it's a WrapShop-OS-operator-level flag scoped
    // to whoever runs the platform.
    PLATFORM_ADMIN_EMAILS: z.string().default(""),

    // Dev safety net: when set (and NODE_ENV != production), any outbound
    // customer email is redirected here instead of the real address. Lets
    // you test the invoice-email flow end-to-end without risking a real
    // customer inbox during dev iteration.
    DEV_EMAIL_OVERRIDE: z.string().email().optional(),
  },

  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
    NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
    NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  },

  // In Next.js Edge / browser, we can't access `process.env` for server-side
  // values — but Next replaces `NEXT_PUBLIC_*` at build time.
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,

    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,

    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_WEBHOOK_SECRET: process.env.RESEND_WEBHOOK_SECRET,
    EMAIL_FROM: process.env.EMAIL_FROM,

    QBO_CLIENT_ID: process.env.QBO_CLIENT_ID,
    QBO_CLIENT_SECRET: process.env.QBO_CLIENT_SECRET,
    QBO_WEBHOOK_VERIFIER: process.env.QBO_WEBHOOK_VERIFIER,
    QBO_ENVIRONMENT: process.env.QBO_ENVIRONMENT,

    INNGEST_EVENT_KEY: process.env.INNGEST_EVENT_KEY,
    INNGEST_SIGNING_KEY: process.env.INNGEST_SIGNING_KEY,

    SENTRY_DSN: process.env.SENTRY_DSN,
    PLATFORM_ADMIN_EMAILS: process.env.PLATFORM_ADMIN_EMAILS,
    DEV_EMAIL_OVERRIDE: process.env.DEV_EMAIL_OVERRIDE,

    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  },

  // Skip validation during Next lint / typegen where env isn't loaded.
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
