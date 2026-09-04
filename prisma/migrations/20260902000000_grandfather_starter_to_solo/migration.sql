-- 3-tier → 5-tier migration. See src/lib/features.ts for the new hierarchy:
--   free / solo / shop / pro / enterprise
--
-- Grandfathering rule: existing paying customers must never lose access.
--   "starter"    → "solo"   (bump up; starter was the free-ish paid tier)
--   "pro"        → "pro"    (identity)
--   "enterprise" → "enterprise" (identity)
--
-- Organization.tier is a plain TEXT column (no CHECK constraint / enum), so
-- no DDL change is needed. This is a data-only migration.
UPDATE "public"."organizations" SET "tier" = 'solo' WHERE "tier" = 'starter';

-- Subscription status: legacy "trialing" default was misleading (no billing
-- system to trial through). Normalize to "active" for anything not explicitly
-- other. New signups now default to "active" via src/app/onboarding/actions.ts.
UPDATE "public"."organizations" SET "subscriptionStatus" = 'active'
  WHERE "subscriptionStatus" IS NULL OR "subscriptionStatus" = 'trialing';
