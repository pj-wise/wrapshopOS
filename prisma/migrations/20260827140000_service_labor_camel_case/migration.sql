-- Fix column names to match Prisma's quoted-camelCase convention. The
-- previous migration originally created these as snake_case
-- (labor_cost_cents / product_only), which Prisma doesn't know how to
-- select because the model fields have no @map. Every other Service
-- column is quoted camelCase (e.g. "priceCents", "hourlyRateCents"), so
-- this brings the two new columns into line.
--
-- Guarded via information_schema lookup so this is a no-op on any fresh
-- DB where migration 20260827100000_service_labor_and_variable was
-- applied AFTER its own hand-edit that already produces the camelCase
-- names directly. (Postgres doesn't support `IF EXISTS` on RENAME COLUMN,
-- hence the DO block.)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'services'
      AND column_name = 'labor_cost_cents'
  ) THEN
    ALTER TABLE "public"."services" RENAME COLUMN "labor_cost_cents" TO "laborCostCents";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'services'
      AND column_name = 'product_only'
  ) THEN
    ALTER TABLE "public"."services" RENAME COLUMN "product_only" TO "productOnly";
  END IF;
END $$;
