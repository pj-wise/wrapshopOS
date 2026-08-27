import "server-only";

import { Prisma } from "@prisma/client";

import { globalSearchInput } from "@/lib/schemas/crm";
import {
  createTRPCRouter,
  orgProcedure,
  requirePermission,
} from "../init";

/**
 * Global search — combines Postgres FTS (via `search` tsvector column) with
 * trigram similarity on VIN / plate / phone / email so short partial strings
 * still hit. Runs three parallel raw queries so we get proper ranking control.
 *
 * The queries use $queryRaw to leverage Postgres operators the Prisma
 * generator doesn't expose. Each query is manually filtered by
 * `organizationId` — RLS is defense-in-depth but Prisma's raw path bypasses
 * the query-builder extension so we can't rely on `dbFor` here.
 */

export type SearchHit =
  | { type: "customer"; id: string; label: string; sublabel: string | null }
  | { type: "vehicle"; id: string; label: string; sublabel: string | null }
  | { type: "lead"; id: string; label: string; sublabel: string | null };

export const searchRouter = createTRPCRouter({
  global: orgProcedure
    .use(requirePermission("crm:read"))
    .input(globalSearchInput)
    .query(async ({ ctx, input }): Promise<{
      customers: SearchHit[];
      vehicles: SearchHit[];
      leads: SearchHit[];
    }> => {
      const orgId = ctx.session.organizationId;
      const q = input.q;
      const limit = input.limit;

      // websearch_to_tsquery handles "quoted phrases" and OR / - operators
      // gracefully — better UX than plainto_tsquery.
      const [customerRows, vehicleRows, leadRows] = await Promise.all([
        ctx.db.$queryRaw<Array<{ id: string; name: string; email: string | null; phone: string | null }>>(
          Prisma.sql`
            SELECT id, name, email, phone
            FROM public.customers
            WHERE "organizationId" = ${orgId}::uuid
              AND "deletedAt" IS NULL
              AND (
                search @@ websearch_to_tsquery('simple', ${q})
                OR name ILIKE ${"%" + q + "%"}
                OR email ILIKE ${"%" + q + "%"}
                OR phone ILIKE ${"%" + q + "%"}
              )
            ORDER BY ts_rank(search, websearch_to_tsquery('simple', ${q})) DESC,
                     "createdAt" DESC
            LIMIT ${limit}
          `,
        ),
        ctx.db.$queryRaw<Array<{ id: string; vin: string | null; year: number | null; make: string | null; model: string | null; trim: string | null; plate: string | null }>>(
          Prisma.sql`
            SELECT id, vin, year, make, model, trim, plate
            FROM public.vehicles
            WHERE "organizationId" = ${orgId}::uuid
              AND "deletedAt" IS NULL
              AND (
                search @@ websearch_to_tsquery('simple', ${q})
                OR vin ILIKE ${"%" + q.toUpperCase() + "%"}
                OR plate ILIKE ${"%" + q.toUpperCase() + "%"}
              )
            ORDER BY ts_rank(search, websearch_to_tsquery('simple', ${q})) DESC,
                     "createdAt" DESC
            LIMIT ${limit}
          `,
        ),
        ctx.db.$queryRaw<Array<{ id: string; name: string; status: string; source: string }>>(
          Prisma.sql`
            SELECT id, name, status, source
            FROM public.leads
            WHERE "organizationId" = ${orgId}::uuid
              AND "deletedAt" IS NULL
              AND (
                search @@ websearch_to_tsquery('simple', ${q})
                OR name ILIKE ${"%" + q + "%"}
              )
            ORDER BY ts_rank(search, websearch_to_tsquery('simple', ${q})) DESC,
                     "createdAt" DESC
            LIMIT ${limit}
          `,
        ),
      ]);

      return {
        customers: customerRows.map((r) => ({
          type: "customer" as const,
          id: r.id,
          label: r.name,
          sublabel: [r.email, r.phone].filter(Boolean).join(" · ") || null,
        })),
        vehicles: vehicleRows.map((r) => ({
          type: "vehicle" as const,
          id: r.id,
          label:
            [r.year, r.make, r.model, r.trim].filter(Boolean).join(" ") ||
            r.vin ||
            "(unnamed vehicle)",
          sublabel: [r.vin, r.plate].filter(Boolean).join(" · ") || null,
        })),
        leads: leadRows.map((r) => ({
          type: "lead" as const,
          id: r.id,
          label: r.name,
          sublabel: `${r.status} · ${r.source}`,
        })),
      };
    }),
});
