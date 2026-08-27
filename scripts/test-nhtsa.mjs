// Quick smoke test of the NHTSA provider — pulled here to avoid a full test-runner
// setup. Run: node scripts/test-nhtsa.mjs
// Uses tsx-style dynamic import from the compiled provider isn't ideal;
// instead this hits the endpoint directly with the same shape as the provider.

const VINS = [
  "1FTFW1E80RFA12345", // 2024 Ford F-150 (synthetic)
  "5YJ3E1EA0KF317000", // Tesla Model 3 (public)
  "WBS8M9C51J5J77887", // BMW M3
];

for (const vin of VINS) {
  const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${encodeURIComponent(vin)}?format=json`;
  const res = await fetch(url);
  const body = await res.json();
  const r = body.Results?.[0];
  console.log(`${vin} → ${r?.ModelYear ?? "?"} ${r?.Make ?? "?"} ${r?.Model ?? "?"} ${r?.Trim ?? ""}`.trim());
}
