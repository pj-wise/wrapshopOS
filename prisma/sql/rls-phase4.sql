-- WrapShop OS — RLS + FTS for Phase 4 catalog + quotes.
--
-- Applied after `prisma migrate deploy`. Run:
--   pnpm exec prisma db execute --file prisma/sql/rls-phase4.sql --schema prisma/schema.prisma

-- ---------------------------------------------------------------------------
-- Enable RLS on all Phase 4 tables with the standard tenant_isolation policy.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'service_categories',
    'services',
    'vendors',
    'materials',
    'material_rolls',
    'quotes',
    'quote_line_items',
    'quote_revisions',
    'quote_views'
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
-- FTS on quotes (per plan §3.6). Search by quote number, customer/vehicle
-- snapshot on line items, terms, notes.
-- ---------------------------------------------------------------------------
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS "search" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("number"::text, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("status", '')), 'B') ||
    setweight(to_tsvector('simple', f_unaccent(coalesce("customerNotes", ''))), 'C') ||
    setweight(to_tsvector('simple', f_unaccent(coalesce("internalNotes", ''))), 'D') ||
    setweight(to_tsvector('simple', f_unaccent(coalesce("terms", ''))), 'D')
  ) STORED;

CREATE INDEX IF NOT EXISTS quotes_search_gin ON public.quotes USING GIN ("search");

-- ---------------------------------------------------------------------------
-- FTS on services (for search + catalog picker)
-- ---------------------------------------------------------------------------
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS "search" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', f_unaccent(coalesce("name", ''))), 'A') ||
    setweight(to_tsvector('simple', coalesce("sku", '')), 'B') ||
    setweight(to_tsvector('simple', f_unaccent(coalesce("description", ''))), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS services_search_gin ON public.services USING GIN ("search");
