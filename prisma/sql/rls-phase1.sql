-- WrapShop OS — Row-Level Security policies (Phase 1)
--
-- Applied AFTER `prisma migrate dev` so tables exist. Run:
--   pnpm exec prisma db execute --file prisma/sql/rls-phase1.sql --schema prisma/schema.prisma
--
-- Column names are quoted "camelCase" because Prisma preserves case from the
-- schema.prisma model field names (no @map used).
--
-- Model: every tenant-scoped table has RLS enabled with a policy that reads
-- `app.current_org` from the session. The tenant-scoped Prisma client
-- (`dbFor(orgId)`) sets this in a `SET LOCAL` inside a transaction.
--
-- The service-role connection bypasses RLS entirely (Supabase behavior). We
-- rely on the eslint rule + `dbFor()` extension to prevent app-layer leaks.
-- RLS here is defense in depth for any raw SQL or unscoped mistake that
-- somehow slips past.

-- Helper function: extract the current org from session config, safe if unset.
CREATE OR REPLACE FUNCTION current_org() RETURNS uuid AS $$
DECLARE
  v text;
BEGIN
  v := current_setting('app.current_org', true);
  IF v IS NULL OR v = '' THEN
    RETURN NULL;
  END IF;
  RETURN v::uuid;
END;
$$ LANGUAGE plpgsql STABLE;

-- ---------------------------------------------------------------------------
-- organizations: readable when its id matches current_org.
-- ---------------------------------------------------------------------------
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON public.organizations;
CREATE POLICY tenant_isolation ON public.organizations
  USING (id = current_org())
  WITH CHECK (id = current_org());

-- ---------------------------------------------------------------------------
-- Standard org-scoped tables — all share the same policy shape.
-- Iterate via a DO block; note the QUOTED "organizationId" identifier.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'locations',
    'org_members',
    'invitations',
    'feature_overrides',
    'external_integrations',
    'notifications',
    'files',
    'audit_logs',
    'timeline_events'
  ]) LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I;', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON public.%I '
      'USING ("organizationId" = current_org()) '
      'WITH CHECK ("organizationId" = current_org());',
      t
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- roles: system roles (organizationId NULL) globally readable; org roles
-- follow the tenant rule.
-- ---------------------------------------------------------------------------
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_roles ON public.roles;
CREATE POLICY tenant_isolation_roles ON public.roles
  USING ("organizationId" IS NULL OR "organizationId" = current_org())
  WITH CHECK ("organizationId" = current_org());

-- ---------------------------------------------------------------------------
-- webhook_events: allow rows with NULL org (pre-processing) or matching org.
-- ---------------------------------------------------------------------------
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_webhooks ON public.webhook_events;
CREATE POLICY tenant_isolation_webhooks ON public.webhook_events
  USING ("organizationId" IS NULL OR "organizationId" = current_org())
  WITH CHECK ("organizationId" IS NULL OR "organizationId" = current_org());

-- ---------------------------------------------------------------------------
-- Global tables (no tenant column): permissions, role_permissions, users
-- Intentionally NOT under RLS — access-controlled at the app layer.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Trigger: mirror auth.users into public.users on signup.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, name, "avatarUrl", "createdAt", "updatedAt")
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    "updatedAt" = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- Extensions we'll need for later phases (consolidate here).
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
