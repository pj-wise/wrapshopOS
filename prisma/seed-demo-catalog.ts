/**
 * Demo catalog seeder — populates realistic restyling services, materials, and
 * vendors for whichever org has --org-id=<uuid> passed. Idempotent per (orgId,
 * name) so re-running is safe.
 *
 * Run:
 *   pnpm exec tsx prisma/seed-demo-catalog.ts --org-id <your-org-uuid>
 *
 * PJ's shop: pull the org id from the app (Settings → Shop) or via psql.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function centsFromDollars(d: number): number {
  return Math.round(d * 100);
}

async function main() {
  const orgArgIdx = process.argv.indexOf("--org-id");
  if (orgArgIdx === -1 || !process.argv[orgArgIdx + 1]) {
    throw new Error("Usage: pnpm exec tsx prisma/seed-demo-catalog.ts --org-id <uuid>");
  }
  const organizationId = process.argv[orgArgIdx + 1];

  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!org) throw new Error(`Organization ${organizationId} not found.`);
  console.log(`Seeding demo catalog for org "${org.name}" (${organizationId})`);

  // ------------------------------------------------------------------
  // Service categories
  // ------------------------------------------------------------------
  const categories = [
    { key: "wraps", name: "Vinyl Wraps", sortOrder: 10 },
    { key: "ppf", name: "Paint Protection Film", sortOrder: 20 },
    { key: "tint", name: "Window Tint", sortOrder: 30 },
    { key: "ceramic", name: "Ceramic Coatings", sortOrder: 40 },
    { key: "detail", name: "Detailing", sortOrder: 50 },
  ];
  const catByKey: Record<string, string> = {};
  for (const c of categories) {
    const existing = await prisma.serviceCategory.findFirst({
      where: { organizationId, key: c.key },
    });
    const row = existing
      ? await prisma.serviceCategory.update({ where: { id: existing.id }, data: c })
      : await prisma.serviceCategory.create({ data: { ...c, organizationId } });
    catByKey[c.key] = row.id;
  }
  console.log(`  ✓ ${categories.length} categories`);

  // ------------------------------------------------------------------
  // Services — realistic restyling shop menu
  // ------------------------------------------------------------------
  const services: Array<{
    categoryKey: string;
    name: string;
    description?: string;
    pricingModel: "flat" | "coverage" | "hourly" | "matrix";
    priceCents: number;
    hourlyRateCents?: number;
    estimatedHours?: number;
    defaultCoverageSqft?: number;
    matrixJson?: Record<string, number>;
    depositPercent?: number;
    defaultLaborHours?: number;
    defaultMaterialSqft?: number;
    defaultDurationDays?: number;
  }> = [
    // ---- Wraps ----
    {
      categoryKey: "wraps",
      name: "Full Color Change Wrap",
      description: "Complete vehicle color change with disassembly, wrap install, and reassembly.",
      pricingModel: "matrix",
      priceCents: centsFromDollars(3500),
      matrixJson: {
        compact: centsFromDollars(3200),
        sedan: centsFromDollars(3500),
        coupe: centsFromDollars(3400),
        suv: centsFromDollars(4200),
        truck: centsFromDollars(4600),
        van: centsFromDollars(4800),
        exotic: centsFromDollars(6500),
      },
      depositPercent: 25,
      defaultLaborHours: 30,
      defaultMaterialSqft: 75,
      defaultDurationDays: 4,
    },
    {
      categoryKey: "wraps",
      name: "Partial Wrap (Roof + Hood + Mirrors)",
      pricingModel: "matrix",
      priceCents: centsFromDollars(1200),
      matrixJson: {
        sedan: centsFromDollars(1200),
        coupe: centsFromDollars(1100),
        suv: centsFromDollars(1500),
        truck: centsFromDollars(1600),
      },
      depositPercent: 25,
      defaultLaborHours: 10,
    },
    {
      categoryKey: "wraps",
      name: "Chrome Delete",
      pricingModel: "matrix",
      priceCents: centsFromDollars(650),
      matrixJson: {
        sedan: centsFromDollars(650),
        coupe: centsFromDollars(650),
        suv: centsFromDollars(750),
        truck: centsFromDollars(800),
      },
      defaultLaborHours: 5,
    },
    {
      categoryKey: "wraps",
      name: "Roof Wrap",
      pricingModel: "flat",
      priceCents: centsFromDollars(450),
      defaultLaborHours: 3,
    },
    {
      categoryKey: "wraps",
      name: "Racing Stripes",
      pricingModel: "flat",
      priceCents: centsFromDollars(650),
      defaultLaborHours: 4,
    },

    // ---- PPF ----
    {
      categoryKey: "ppf",
      name: "Full Front PPF",
      description: "Bumper, hood, fenders, mirrors. Protects the highest-impact zones.",
      pricingModel: "coverage",
      priceCents: centsFromDollars(32),
      defaultCoverageSqft: 60,
      depositPercent: 25,
      defaultLaborHours: 8,
    },
    {
      categoryKey: "ppf",
      name: "Track Pack PPF",
      description: "Full front + rocker panels + lower doors.",
      pricingModel: "coverage",
      priceCents: centsFromDollars(30),
      defaultCoverageSqft: 90,
      depositPercent: 25,
      defaultLaborHours: 12,
    },
    {
      categoryKey: "ppf",
      name: "Full Body PPF",
      pricingModel: "coverage",
      priceCents: centsFromDollars(28),
      defaultCoverageSqft: 220,
      depositPercent: 30,
      defaultLaborHours: 40,
      defaultDurationDays: 5,
    },
    {
      categoryKey: "ppf",
      name: "Headlight PPF",
      pricingModel: "flat",
      priceCents: centsFromDollars(199),
    },
    {
      categoryKey: "ppf",
      name: "Door Cup PPF",
      pricingModel: "flat",
      priceCents: centsFromDollars(89),
    },

    // ---- Tint ----
    {
      categoryKey: "tint",
      name: "All-Around Tint — Sedan",
      description: "All side + rear windows. VLT selected during check-in.",
      pricingModel: "flat",
      priceCents: centsFromDollars(299),
      defaultLaborHours: 2,
    },
    {
      categoryKey: "tint",
      name: "Ceramic Tint — SUV/Truck",
      pricingModel: "flat",
      priceCents: centsFromDollars(499),
      defaultLaborHours: 3,
    },
    {
      categoryKey: "tint",
      name: "Windshield Strip",
      pricingModel: "flat",
      priceCents: centsFromDollars(99),
    },
    {
      categoryKey: "tint",
      name: "Full Windshield Ceramic",
      pricingModel: "flat",
      priceCents: centsFromDollars(349),
    },

    // ---- Ceramic ----
    {
      categoryKey: "ceramic",
      name: "Ceramic Coating Level 1 (1yr)",
      pricingModel: "flat",
      priceCents: centsFromDollars(499),
    },
    {
      categoryKey: "ceramic",
      name: "Ceramic Coating Level 2 (3yr)",
      pricingModel: "flat",
      priceCents: centsFromDollars(900),
    },
    {
      categoryKey: "ceramic",
      name: "Ceramic Coating Level 3 (5yr)",
      pricingModel: "flat",
      priceCents: centsFromDollars(1400),
    },
    {
      categoryKey: "ceramic",
      name: "Wheel + Caliper Coating",
      pricingModel: "flat",
      priceCents: centsFromDollars(299),
    },

    // ---- Detailing ----
    {
      categoryKey: "detail",
      name: "Wash & Decon (Pre-install prep)",
      pricingModel: "flat",
      priceCents: centsFromDollars(150),
      defaultLaborHours: 1.5,
    },
    {
      categoryKey: "detail",
      name: "Custom labor (per hour)",
      pricingModel: "hourly",
      priceCents: 0,
      hourlyRateCents: centsFromDollars(125),
      estimatedHours: 1,
    },
  ];

  for (const s of services) {
    const existing = await prisma.service.findFirst({
      where: { organizationId, name: s.name, deletedAt: null },
    });
    const data = {
      organizationId,
      categoryId: catByKey[s.categoryKey],
      name: s.name,
      description: s.description ?? null,
      pricingModel: s.pricingModel,
      priceCents: s.priceCents,
      hourlyRateCents: s.hourlyRateCents ?? null,
      estimatedHours: s.estimatedHours ?? null,
      defaultCoverageSqft: s.defaultCoverageSqft ?? null,
      matrixJson: (s.matrixJson ?? {}) as never,
      depositPercent: s.depositPercent ?? 0,
      defaultLaborHours: s.defaultLaborHours ?? null,
      defaultMaterialSqft: s.defaultMaterialSqft ?? null,
      defaultDurationDays: s.defaultDurationDays ?? null,
      taxable: true,
      active: true,
    };
    if (existing) {
      await prisma.service.update({ where: { id: existing.id }, data });
    } else {
      await prisma.service.create({ data });
    }
  }
  console.log(`  ✓ ${services.length} services`);

  // ------------------------------------------------------------------
  // Vendors + materials
  // ------------------------------------------------------------------
  const vendors = [
    { name: "3M", website: "https://www.3m.com" },
    { name: "Avery Dennison", website: "https://graphics.averydennison.com" },
    { name: "Inozetek", website: "https://www.inozetekusa.com" },
    { name: "XPEL", website: "https://www.xpel.com" },
    { name: "STEK", website: "https://www.stekusa.com" },
    { name: "LLumar", website: "https://www.llumar.com" },
    { name: "SunTek", website: "https://www.suntekfilms.com" },
    { name: "KPMF", website: "https://www.kpmf.co.uk" },
  ];
  const vendorByName: Record<string, string> = {};
  for (const v of vendors) {
    const existing = await prisma.vendor.findFirst({
      where: { organizationId, name: v.name, deletedAt: null },
    });
    const row = existing
      ? await prisma.vendor.update({ where: { id: existing.id }, data: v })
      : await prisma.vendor.create({ data: { ...v, organizationId } });
    vendorByName[v.name] = row.id;
  }
  console.log(`  ✓ ${vendors.length} vendors`);

  const materials: Array<{
    name: string;
    category: "vinyl" | "clear_ppf" | "colored_ppf" | "matte_ppf" | "tint" | "ceramic";
    vendor: string;
    manufacturer?: string;
    series?: string;
    color?: string;
    finish?: string;
    widthIn: number;
    costPerFootCents: number;
  }> = [
    { name: "3M 2080 Satin Black", category: "vinyl", vendor: "3M", manufacturer: "3M", series: "2080", color: "Satin Black", finish: "satin", widthIn: 60, costPerFootCents: centsFromDollars(11) },
    { name: "3M 2080 Gloss Midnight Purple", category: "vinyl", vendor: "3M", manufacturer: "3M", series: "2080", color: "Midnight Purple", finish: "gloss", widthIn: 60, costPerFootCents: centsFromDollars(12) },
    { name: "Avery SW900 Satin Metallic Dark Basalt", category: "vinyl", vendor: "Avery Dennison", manufacturer: "Avery Dennison", series: "SW900", color: "Dark Basalt", finish: "satin", widthIn: 60, costPerFootCents: centsFromDollars(11.5) },
    { name: "Inozetek Super Gloss Midnight Purple", category: "vinyl", vendor: "Inozetek", manufacturer: "Inozetek", color: "Midnight Purple", finish: "gloss", widthIn: 60, costPerFootCents: centsFromDollars(10) },
    { name: "KPMF K88551 Matte Anthracite", category: "vinyl", vendor: "KPMF", manufacturer: "KPMF", series: "K88551", color: "Anthracite", finish: "matte", widthIn: 60, costPerFootCents: centsFromDollars(11) },

    { name: "XPEL Ultimate Plus (clear)", category: "clear_ppf", vendor: "XPEL", manufacturer: "XPEL", series: "Ultimate Plus", finish: "gloss", widthIn: 60, costPerFootCents: centsFromDollars(18) },
    { name: "XPEL Stealth (matte PPF)", category: "matte_ppf", vendor: "XPEL", manufacturer: "XPEL", series: "Stealth", finish: "matte", widthIn: 60, costPerFootCents: centsFromDollars(22) },
    { name: "STEK Dynoshield (clear)", category: "clear_ppf", vendor: "STEK", manufacturer: "STEK", series: "Dynoshield", finish: "gloss", widthIn: 60, costPerFootCents: centsFromDollars(17) },
    { name: "SunTek Ultra (clear)", category: "clear_ppf", vendor: "SunTek", manufacturer: "SunTek", series: "Ultra", finish: "gloss", widthIn: 60, costPerFootCents: centsFromDollars(16) },

    { name: "LLumar CTX Ceramic 35%", category: "tint", vendor: "LLumar", manufacturer: "LLumar", series: "CTX", color: "35% VLT", widthIn: 40, costPerFootCents: centsFromDollars(8) },
    { name: "LLumar CTX Ceramic 20%", category: "tint", vendor: "LLumar", manufacturer: "LLumar", series: "CTX", color: "20% VLT", widthIn: 40, costPerFootCents: centsFromDollars(8) },
    { name: "3M FX Premium 20%", category: "tint", vendor: "3M", manufacturer: "3M", series: "FX Premium", color: "20% VLT", widthIn: 40, costPerFootCents: centsFromDollars(6) },
  ];

  for (const m of materials) {
    const existing = await prisma.material.findFirst({
      where: { organizationId, name: m.name, deletedAt: null },
    });
    const data = {
      organizationId,
      vendorId: vendorByName[m.vendor],
      name: m.name,
      category: m.category,
      manufacturer: m.manufacturer ?? null,
      series: m.series ?? null,
      color: m.color ?? null,
      finish: m.finish ?? null,
      widthIn: m.widthIn,
      costPerFootCents: m.costPerFootCents,
      active: true,
    };
    if (existing) {
      await prisma.material.update({ where: { id: existing.id }, data });
    } else {
      await prisma.material.create({ data });
    }
  }
  console.log(`  ✓ ${materials.length} materials`);

  console.log("\nDemo catalog seeded. Head to /admin/settings/services + /inventory to browse.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
