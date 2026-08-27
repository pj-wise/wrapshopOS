/**
 * Curated list of common car makes relevant to a restyling shop. NHTSA's
 * `GetAllMakes` endpoint returns 14k+ entries (industry equipment, trailer
 * mfrs, etc.) which is too many for a picker.
 *
 * The list is roughly ordered by "how often we expect to see one in a wrap /
 * PPF / tint bay." An "Other…" escape hatch in the UI lets a user free-type
 * anything not on this list.
 */
export const COMMON_MAKES = [
  "Acura",
  "Alfa Romeo",
  "Aston Martin",
  "Audi",
  "BMW",
  "Bentley",
  "Bugatti",
  "Buick",
  "Cadillac",
  "Chevrolet",
  "Chrysler",
  "Dodge",
  "Ferrari",
  "Fiat",
  "Ford",
  "GMC",
  "Genesis",
  "Honda",
  "Hyundai",
  "Infiniti",
  "Jaguar",
  "Jeep",
  "Karma",
  "Kia",
  "Lamborghini",
  "Land Rover",
  "Lexus",
  "Lincoln",
  "Lotus",
  "Lucid",
  "Maserati",
  "Mazda",
  "McLaren",
  "Mercedes-Benz",
  "Mini",
  "Mitsubishi",
  "Nissan",
  "Polestar",
  "Porsche",
  "RAM",
  "Rivian",
  "Rolls-Royce",
  "Subaru",
  "Tesla",
  "Toyota",
  "Volkswagen",
  "Volvo",
] as const;

export type CommonMake = (typeof COMMON_MAKES)[number];

/**
 * Model years to expose in a year picker. Restyling shops occasionally see
 * classics but the vast majority of work is on modern vehicles, so 1990 →
 * next model year keeps the list reasonable. Rendered newest-first in the UI.
 */
export function modelYearOptions(currentYear = new Date().getFullYear()): number[] {
  const years: number[] = [];
  // NHTSA data goes forward one model year (e.g. 2027 available in late 2026).
  for (let y = currentYear + 1; y >= 1990; y--) years.push(y);
  return years;
}
