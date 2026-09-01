/**
 * Shared label formatter for calendar/schedule chips + the "Pending
 * Scheduling" list. Puts the first accepted service before the customer
 * name so a glance at the day tells you WHAT is happening AND for WHOM:
 *   "Full Front PPF — John Smith"
 *
 * Client-safe (no `server-only` import); can be used inside `"use client"`
 * components without pulling server modules into the client bundle.
 */

export type JobLabelInput = {
  title: string | null;
  customer: { name: string };
  vehicle?: {
    year: number | null;
    make: string | null;
    model: string | null;
  } | null;
  quote?: {
    items: Array<{
      description: string;
      isUpsell: boolean;
      upsellAccepted: boolean | null;
      sortOrder: number;
    }>;
  } | null;
};

export function formatJobScheduleLabel(job: JobLabelInput): string {
  const firstService = [...(job.quote?.items ?? [])]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .find((i) => !i.isUpsell || i.upsellAccepted)?.description;
  if (firstService) return `${firstService} — ${job.customer.name}`;

  // Fallback chain — matches what each render site was doing before.
  const vehicleStr = formatJobVehicleLabel(job.vehicle) ?? "";
  return job.title || vehicleStr || job.customer.name;
}

/**
 * "2024 Tesla Model 3" (as much as is available). Returns null when the
 * vehicle has nothing at all — callers can conditionally render.
 */
export function formatJobVehicleLabel(
  vehicle: JobLabelInput["vehicle"] | undefined,
): string | null {
  if (!vehicle) return null;
  const parts = [vehicle.year, vehicle.make, vehicle.model].filter(
    (v) => v != null && v !== "",
  );
  return parts.length > 0 ? parts.join(" ") : null;
}
