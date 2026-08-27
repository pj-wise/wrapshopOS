-- Adds labor cost + product-only toggle to Service.
--
-- `pricing_model = "variable"` is a new UI-facing model that stores its
-- options inside the existing `matrix_json` column as
--   { variableType, variableLabel, options: [{ key, label, priceCents }] }
-- No schema change needed for that — matrix_json is already `jsonb`.

ALTER TABLE "public"."services" ADD COLUMN "laborCostCents" integer;
ALTER TABLE "public"."services" ADD COLUMN "productOnly" boolean NOT NULL DEFAULT false;
