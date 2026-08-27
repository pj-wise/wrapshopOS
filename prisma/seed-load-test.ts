/**
 * Load-test seeder — inflates one org up to plan §7 scale:
 *   500 customers, 1000 vehicles, 200 open jobs
 *
 * Idempotent by name-prefix ("[LT] "). Re-running skips existing rows so you
 * can safely rerun to top up. Includes a rough perf report at the end that
 * times FTS + Kanban queries so we can eyeball whether the shop scales.
 *
 * Run:
 *   pnpm exec tsx prisma/seed-load-test.ts --org-id <uuid>
 *   pnpm exec tsx prisma/seed-load-test.ts --org-id <uuid> --fresh   # wipes existing [LT] rows first
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CUSTOMER_COUNT = 500;
const VEHICLE_COUNT = 1000;
const OPEN_JOB_COUNT = 200;
const NAME_PREFIX = "[LT] ";

// Deterministic RNG so runs produce comparable seeds.
function mulberry32(seed: number) {
  let a = seed;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42);

const FIRST = [
  "Marcus", "Ava", "Devon", "Priya", "Kenji", "Sofia", "Chase", "Nina",
  "Malik", "Zoe", "Enzo", "Selin", "Hugo", "Lena", "Ryder", "Aria",
];
const LAST = [
  "Chen", "Nguyen", "Alvarez", "Patel", "Cohen", "Martinez", "Reyes", "Kim",
  "Yamada", "Ferrari", "Kowalski", "Silva", "Diallo", "Petrov", "Adebayo", "O'Brien",
];
const MAKES = [
  { make: "Ford", models: ["F-150", "Mustang", "Bronco"] },
  { make: "Toyota", models: ["Tacoma", "GR86", "Supra"] },
  { make: "BMW", models: ["M3", "M4", "M240i"] },
  { make: "Porsche", models: ["911", "Cayman", "Macan"] },
  { make: "Tesla", models: ["Model 3", "Model Y", "Model S"] },
  { make: "Chevrolet", models: ["Corvette", "Silverado", "Camaro"] },
];
const COLORS = ["Black", "White", "Silver", "Red", "Blue", "Grey"];
const JOB_STAGES = [
  "pending", "ready", "scheduled", "checked_in", "prep",
  "in_progress", "qc", "ready_for_pickup",
] as const;

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)]!;
}

function randVin(): string {
  const chars = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789"; // no I/O/Q
  let s = "";
  for (let i = 0; i < 17; i++) s += chars[Math.floor(rand() * chars.length)];
  return s;
}

async function main() {
  const orgArgIdx = process.argv.indexOf("--org-id");
  if (orgArgIdx === -1 || !process.argv[orgArgIdx + 1]) {
    throw new Error("Usage: pnpm exec tsx prisma/seed-load-test.ts --org-id <uuid> [--fresh]");
  }
  const organizationId = process.argv[orgArgIdx + 1];
  const fresh = process.argv.includes("--fresh");

  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!org) throw new Error(`Organization ${organizationId} not found.`);

  console.log(`\nLoad-test seed → ${org.name} (${organizationId})`);
  console.log(`Target: ${CUSTOMER_COUNT} customers, ${VEHICLE_COUNT} vehicles, ${OPEN_JOB_COUNT} open jobs\n`);

  if (fresh) {
    console.log("Wiping existing [LT] rows…");
    await prisma.job.deleteMany({
      where: { organizationId, title: { startsWith: NAME_PREFIX } },
    });
    await prisma.vehicle.deleteMany({
      where: { organizationId, notes: { startsWith: NAME_PREFIX } },
    });
    await prisma.customer.deleteMany({
      where: { organizationId, name: { startsWith: NAME_PREFIX } },
    });
  }

  // ------------------------- Customers -------------------------
  const existingCustomers = await prisma.customer.count({
    where: { organizationId, name: { startsWith: NAME_PREFIX } },
  });
  const toCreateCustomers = Math.max(0, CUSTOMER_COUNT - existingCustomers);
  console.log(`Customers: existing=${existingCustomers}, creating=${toCreateCustomers}`);
  const customerIds: string[] = [];
  if (toCreateCustomers > 0) {
    const rows = Array.from({ length: toCreateCustomers }, (_, i) => {
      const first = pick(FIRST);
      const last = pick(LAST);
      const n = existingCustomers + i + 1;
      return {
        organizationId,
        type: "individual",
        name: `${NAME_PREFIX}${first} ${last} #${n}`,
        email: `lt+${n}@example.com`,
        phone: `555${String(1000000 + n).slice(1)}`,
        tags: [],
      };
    });
    // createMany in batches to avoid the 65k parameter cap.
    const batchSize = 500;
    for (let i = 0; i < rows.length; i += batchSize) {
      await prisma.customer.createMany({
        data: rows.slice(i, i + batchSize),
      });
    }
  }
  const allCustomers = await prisma.customer.findMany({
    where: { organizationId, name: { startsWith: NAME_PREFIX } },
    select: { id: true },
    take: CUSTOMER_COUNT,
  });
  customerIds.push(...allCustomers.map((c) => c.id));
  console.log(`  ✓ ${customerIds.length} customers on hand`);

  // ------------------------- Vehicles -------------------------
  const existingVehicles = await prisma.vehicle.count({
    where: { organizationId, notes: { startsWith: NAME_PREFIX } },
  });
  const toCreateVehicles = Math.max(0, VEHICLE_COUNT - existingVehicles);
  console.log(`Vehicles:  existing=${existingVehicles}, creating=${toCreateVehicles}`);
  if (toCreateVehicles > 0) {
    const rows = Array.from({ length: toCreateVehicles }, (_, i) => {
      const mm = pick(MAKES);
      return {
        organizationId,
        customerId: customerIds[Math.floor(rand() * customerIds.length)],
        vin: randVin(),
        year: 2015 + Math.floor(rand() * 12),
        make: mm.make,
        model: pick(mm.models),
        color: pick(COLORS),
        plate: `LT${String(existingVehicles + i + 1).padStart(6, "0")}`,
        notes: `${NAME_PREFIX}load test`,
        decodedData: {},
      };
    });
    const batchSize = 500;
    for (let i = 0; i < rows.length; i += batchSize) {
      await prisma.vehicle.createMany({
        data: rows.slice(i, i + batchSize),
      });
    }
  }
  const allVehicles = await prisma.vehicle.findMany({
    where: { organizationId, notes: { startsWith: NAME_PREFIX } },
    select: { id: true, customerId: true },
    take: VEHICLE_COUNT,
  });
  console.log(`  ✓ ${allVehicles.length} vehicles on hand`);

  // ------------------------- Jobs -------------------------
  const existingJobs = await prisma.job.count({
    where: {
      organizationId,
      title: { startsWith: NAME_PREFIX },
      status: { in: [...JOB_STAGES] },
    },
  });
  const toCreateJobs = Math.max(0, OPEN_JOB_COUNT - existingJobs);
  console.log(`Jobs:      existing=${existingJobs}, creating=${toCreateJobs}`);
  if (toCreateJobs > 0) {
    // Find next per-org job number.
    const last = await prisma.job.findFirst({
      where: { organizationId },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    let nextNumber = (last?.number ?? 0) + 1;

    const rows = Array.from({ length: toCreateJobs }, () => {
      const v = allVehicles[Math.floor(rand() * allVehicles.length)];
      if (!v || !v.customerId) return null;
      const n = nextNumber++;
      return {
        organizationId,
        customerId: v.customerId,
        vehicleId: v.id,
        number: n,
        status: pick(JOB_STAGES),
        priority: "normal",
        title: `${NAME_PREFIX}job #${n}`,
        summary: "Load-test job",
        assignedTechIds: [] as string[],
      };
    }).filter(Boolean) as Array<{
      organizationId: string;
      customerId: string;
      vehicleId: string;
      number: number;
      status: string;
      priority: string;
      title: string;
      summary: string;
      assignedTechIds: string[];
    }>;

    const batchSize = 500;
    for (let i = 0; i < rows.length; i += batchSize) {
      await prisma.job.createMany({ data: rows.slice(i, i + batchSize) });
    }
  }
  const openJobCount = await prisma.job.count({
    where: {
      organizationId,
      title: { startsWith: NAME_PREFIX },
      status: { in: [...JOB_STAGES] },
    },
  });
  console.log(`  ✓ ${openJobCount} open load-test jobs`);

  // ------------------------- Perf sanity check -------------------------
  console.log("\nTiming a few hot queries…");
  await timeOp("customers.list (top 50)", () =>
    prisma.customer.findMany({
      where: { organizationId, deletedAt: null },
      take: 50,
      orderBy: { createdAt: "desc" },
    }),
  );
  await timeOp("vehicles by VIN ILIKE prefix", () =>
    prisma.vehicle.findMany({
      where: { organizationId, vin: { startsWith: "1FTFW" } },
      take: 20,
    }),
  );
  await timeOp("jobs kanban (200 rows w/ joins)", () =>
    prisma.job.findMany({
      where: { organizationId, deletedAt: null },
      take: 200,
      orderBy: [{ scheduledStart: "asc" }, { createdAt: "desc" }],
      include: {
        customer: { select: { id: true, name: true } },
        vehicle: {
          select: { id: true, year: true, make: true, model: true, trim: true, vin: true },
        },
        bay: { select: { id: true, name: true } },
      },
    }),
  );

  await prisma.$disconnect();
}

async function timeOp(label: string, fn: () => Promise<unknown>) {
  const start = Date.now();
  await fn();
  const ms = Date.now() - start;
  const flag = ms < 400 ? "✓" : ms < 800 ? "!" : "✗";
  console.log(`  ${flag} ${label.padEnd(38)} ${ms} ms`);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
