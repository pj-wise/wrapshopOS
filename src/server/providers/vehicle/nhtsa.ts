import "server-only";

import type { VehicleDataProvider, VehicleDecodeResult } from "../types";

/**
 * NHTSA vPIC — the U.S. government's free VIN decoding API.
 *
 * Endpoint: https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/{vin}?format=json
 *
 * No auth, no rate limit officially documented (~100 req/s polite).
 * Decoded VINs are safe to cache permanently — VINs never change.
 *
 * ASSUMPTION TO VERIFY (plan §5): payload shape via `Results[0]`. Confirmed
 * for GM/Ford/Stellantis/Toyota/Tesla/BMW in Phase 2 verification.
 */

const NHTSA_BASE = "https://vpic.nhtsa.dot.gov/api/vehicles";
const REQUEST_TIMEOUT_MS = 10_000;

// The subset of fields we actually care about, mapped from NHTSA field names.
// See https://vpic.nhtsa.dot.gov/api/Home/Index/LanguageMode for full catalog.
type NhtsaResult = {
  VIN?: string;
  ModelYear?: string;
  Make?: string;
  Model?: string;
  Trim?: string;
  BodyClass?: string;
  VehicleType?: string;
  Manufacturer?: string;
  EngineModel?: string;
  DisplacementL?: string;
  FuelTypePrimary?: string;
  PlantCountry?: string;
  ErrorText?: string;
  [k: string]: string | undefined;
};

type NhtsaResponse = {
  Count: number;
  Message: string;
  Results: NhtsaResult[];
};

export function createNhtsaProvider(): VehicleDataProvider {
  return {
    name: "nhtsa",
    capabilities: ["vin_decode"] as const,

    async decodeVin(vin: string): Promise<VehicleDecodeResult> {
      const clean = vin.trim().toUpperCase();
      if (clean.length !== 17) {
        throw new Error(`Invalid VIN: expected 17 chars, got ${clean.length}`);
      }

      const url = `${NHTSA_BASE}/DecodeVinValuesExtended/${encodeURIComponent(clean)}?format=json`;
      const ac = new AbortController();
      const timeout = setTimeout(() => ac.abort(), REQUEST_TIMEOUT_MS);

      try {
        const res = await fetch(url, {
          signal: ac.signal,
          headers: { "user-agent": "wrapshop-os/1.0" },
        });
        if (!res.ok) {
          throw new Error(`NHTSA HTTP ${res.status}`);
        }

        const body = (await res.json()) as NhtsaResponse;
        const row = body.Results?.[0];
        if (!row) throw new Error("NHTSA returned empty Results");

        const engineParts = [row.EngineModel, row.DisplacementL ? `${row.DisplacementL}L` : null]
          .filter(Boolean)
          .join(" ");

        const errors = (row.ErrorText ?? "")
          .split(";")
          .map((s) => s.trim())
          .filter((s) => s && s !== "0");

        return {
          vin: clean,
          year: parseIntOrNull(row.ModelYear),
          make: nonEmpty(row.Make),
          model: nonEmpty(row.Model),
          trim: nonEmpty(row.Trim),
          bodyClass: nonEmpty(row.BodyClass),
          vehicleType: nonEmpty(row.VehicleType),
          manufacturer: nonEmpty(row.Manufacturer),
          engine: nonEmpty(engineParts),
          fuelType: nonEmpty(row.FuelTypePrimary),
          plantCountry: nonEmpty(row.PlantCountry),
          errors,
          raw: row as Record<string, unknown>,
          providerName: "nhtsa",
          decodedAt: new Date().toISOString(),
        };
      } finally {
        clearTimeout(timeout);
      }
    },

    /**
     * NHTSA endpoint: `/GetModelsForMakeYear/make/{make}/modelyear/{year}?format=json`
     * Returns an array of `{ Model_Name: string }`. We dedupe (NHTSA sometimes
     * returns "Model 3" and "Model 3 Long Range" separately) and sort A→Z.
     */
    async getModels(year: number, make: string): Promise<string[]> {
      const url = `${NHTSA_BASE}/GetModelsForMakeYear/make/${encodeURIComponent(make)}/modelyear/${year}?format=json`;
      const ac = new AbortController();
      const timeout = setTimeout(() => ac.abort(), REQUEST_TIMEOUT_MS);
      try {
        const res = await fetch(url, {
          signal: ac.signal,
          headers: { "user-agent": "wrapshop-os/1.0" },
        });
        if (!res.ok) return [];
        const body = (await res.json()) as {
          Results?: Array<{ Model_Name?: string }>;
        };
        const set = new Set<string>();
        for (const row of body.Results ?? []) {
          const name = row.Model_Name?.trim();
          if (name) set.add(name);
        }
        return Array.from(set).sort((a, b) => a.localeCompare(b));
      } catch {
        return [];
      } finally {
        clearTimeout(timeout);
      }
    },

    async healthCheck() {
      const start = Date.now();
      try {
        // GetAllMakes is a cheap heartbeat endpoint.
        const res = await fetch(`${NHTSA_BASE}/GetAllMakes?format=json`, {
          signal: AbortSignal.timeout(5000),
        });
        return {
          ok: res.ok,
          latencyMs: Date.now() - start,
          message: res.ok ? undefined : `HTTP ${res.status}`,
          checkedAt: new Date().toISOString(),
        };
      } catch (err) {
        return {
          ok: false,
          latencyMs: Date.now() - start,
          message: err instanceof Error ? err.message : String(err),
          checkedAt: new Date().toISOString(),
        };
      }
    },
  };
}

function parseIntOrNull(v: string | undefined): number | null {
  if (!v) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function nonEmpty(v: string | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t.length === 0 || t === "Not Applicable" || t === "0" ? null : t;
}
