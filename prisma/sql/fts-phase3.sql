-- WrapShop OS — Full-text + trigram indexes for CRM (Phase 3)
--
-- Adds generated `search` tsvector columns on customers/vehicles/leads with
-- GIN indexes, and trigram GIN indexes on the exact-match-fuzzy fields
-- (VIN, plate, phone, email). Postgres extensions pg_trgm + unaccent are
-- already enabled by the Phase 1 RLS migration.
--
-- Note: `unaccent(text)` is not IMMUTABLE by default (it depends on the
-- dictionary), which STORED generated columns disallow. We wrap it in
-- `f_unaccent` which we mark IMMUTABLE — a common Postgres idiom.
--
-- Prisma preserves camelCase column names, so all identifiers stay quoted.
-- Run:
--   pnpm exec prisma db execute --file prisma/sql/fts-phase3.sql --schema prisma/schema.prisma

CREATE OR REPLACE FUNCTION public.f_unaccent(text)
  RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
AS $$
  SELECT public.unaccent('public.unaccent', $1)
$$;

-- ---------------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------------
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS "search" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', f_unaccent(coalesce("name",''))), 'A') ||
    setweight(to_tsvector('simple', f_unaccent(coalesce("businessName",''))), 'A') ||
    setweight(to_tsvector('simple', f_unaccent(coalesce("email",''))), 'B') ||
    setweight(to_tsvector('simple', f_unaccent(coalesce("phone",''))), 'B') ||
    setweight(to_tsvector('simple', f_unaccent(coalesce("altPhone",''))), 'C') ||
    setweight(to_tsvector('simple', f_unaccent(coalesce("city",''))), 'C') ||
    setweight(to_tsvector('simple', f_unaccent(coalesce("notes",''))), 'D')
  ) STORED;

CREATE INDEX IF NOT EXISTS customers_search_gin ON public.customers USING GIN ("search");
CREATE INDEX IF NOT EXISTS customers_email_trgm ON public.customers USING GIN ("email" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS customers_phone_trgm ON public.customers USING GIN ("phone" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS customers_altphone_trgm ON public.customers USING GIN ("altPhone" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS customers_name_trgm ON public.customers USING GIN ("name" gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- vehicles
-- ---------------------------------------------------------------------------
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS "search" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("vin",'')), 'A') ||
    setweight(to_tsvector('simple', coalesce("plate",'')), 'A') ||
    setweight(to_tsvector('simple', f_unaccent(coalesce("make",''))), 'B') ||
    setweight(to_tsvector('simple', f_unaccent(coalesce("model",''))), 'B') ||
    setweight(to_tsvector('simple', f_unaccent(coalesce("trim",''))), 'C') ||
    setweight(to_tsvector('simple', f_unaccent(coalesce("color",''))), 'C') ||
    setweight(to_tsvector('simple', f_unaccent(coalesce("notes",''))), 'D')
  ) STORED;

CREATE INDEX IF NOT EXISTS vehicles_search_gin ON public.vehicles USING GIN ("search");
CREATE INDEX IF NOT EXISTS vehicles_vin_trgm ON public.vehicles USING GIN ("vin" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS vehicles_plate_trgm ON public.vehicles USING GIN ("plate" gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- leads
-- ---------------------------------------------------------------------------
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS "search" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', f_unaccent(coalesce("name",''))), 'A') ||
    setweight(to_tsvector('simple', f_unaccent(coalesce("email",''))), 'B') ||
    setweight(to_tsvector('simple', f_unaccent(coalesce("phone",''))), 'B') ||
    setweight(to_tsvector('simple', f_unaccent(coalesce("vehicleDescription",''))), 'C') ||
    setweight(to_tsvector('simple', f_unaccent(coalesce("notes",''))), 'D')
  ) STORED;

CREATE INDEX IF NOT EXISTS leads_search_gin ON public.leads USING GIN ("search");
CREATE INDEX IF NOT EXISTS leads_email_trgm ON public.leads USING GIN ("email" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS leads_phone_trgm ON public.leads USING GIN ("phone" gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Enable RLS on the new tables (matches Phase 1 pattern)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['leads', 'customers', 'vehicles']) LOOP
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
