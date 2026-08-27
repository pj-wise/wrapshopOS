-- WrapShop OS — RLS + FTS for Phase 6 messaging + templates.
-- Idempotent.

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

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'message_threads',
    'messages',
    'message_templates'
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

-- FTS on messages — search bodyText + subject + fromAddress.
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS "search" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', f_unaccent(coalesce("subject", ''))), 'A') ||
    setweight(to_tsvector('simple', coalesce("fromAddress", '')), 'B') ||
    setweight(to_tsvector('simple', coalesce("toAddress", '')), 'B') ||
    setweight(to_tsvector('simple', f_unaccent(coalesce("bodyText", ''))), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS messages_search_gin ON public.messages USING GIN ("search");
