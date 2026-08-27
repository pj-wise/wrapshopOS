-- WrapShop OS — RLS + FTS for Phase 8 billing + accounting.
-- Idempotent.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

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

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'invoices',
    'invoice_line_items',
    'payments',
    'deposits',
    'accounting_connections',
    'accounting_sync_records'
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

-- FTS on invoices: number + status + memo + qbo id.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS "search" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("number"::text, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("status", '')), 'B') ||
    setweight(to_tsvector('simple', coalesce("qboInvoiceId", '')), 'B') ||
    setweight(to_tsvector('simple', coalesce("memo", '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS invoices_search_gin ON public.invoices USING GIN ("search");
