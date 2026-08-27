-- Fix column names to match Prisma's quoted-camelCase convention. The
-- previous migration created these as snake_case (labor_cost_cents /
-- product_only), which Prisma doesn't know how to select because the model
-- fields have no @map. Every other Service column is quoted camelCase
-- (e.g. "priceCents", "hourlyRateCents"), so this brings the two new
-- columns into line.
ALTER TABLE "public"."services" RENAME COLUMN "labor_cost_cents" TO "laborCostCents";
ALTER TABLE "public"."services" RENAME COLUMN "product_only" TO "productOnly";
