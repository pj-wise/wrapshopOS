/**
 * Money helpers. **Everything in the app is integer cents.** Never floats.
 *
 * - `centsFromDollars` / `dollarsFromCents` for I/O boundaries only.
 * - `formatMoney` for display.
 * - `roundToCent` for pricing math that would otherwise introduce fractions.
 */

export type Cents = number;

export function centsFromDollars(dollars: number): Cents {
  return Math.round(dollars * 100);
}

export function dollarsFromCents(cents: Cents): number {
  return cents / 100;
}

export function formatMoney(cents: Cents, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function roundToCent(value: number): Cents {
  return Math.round(value);
}

export function bpsToRate(bps: number): number {
  // 875 basis points -> 0.0875
  return bps / 10000;
}
