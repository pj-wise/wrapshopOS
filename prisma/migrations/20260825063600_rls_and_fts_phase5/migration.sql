-- WrapShop OS — RLS + FTS for Phase 5 production + scheduling.
--
-- Idempotent: rerunnable via `prisma db execute`.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

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

-- Enable RLS on all Phase 5 tables.
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'bays',
    'jobs',
    'checklist_templates',
    'work_orders',
    'checklist_items',
    'check_ins',
    'qc_checks',
    'job_photos',
    'schedule_blocks',
    'availabilities',
    'holidays',
    'time_entries'
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

-- FTS on jobs — search by number, title, summary.
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS "search" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("number"::text, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("status", '')), 'B') ||
    setweight(to_tsvector('simple', f_unaccent(coalesce("title", ''))), 'B') ||
    setweight(to_tsvector('simple', f_unaccent(coalesce("summary", ''))), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS jobs_search_gin ON public.jobs USING GIN ("search");
