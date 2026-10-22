/**
 * Demo shop — "Apex Restyling — Denver, CO", owned by the demo user, with
 * bays, customers, vehicles, leads, quotes, jobs, invoices, and payments.
 *
 * Dates are relative to "now" so the schedule and dashboard always look live.
 * Shared by `prisma/seed-demo-account.ts` (real Supabase) and the in-memory
 * demo database (`src/server/demo/db.ts`).
 */

import { randomBytes } from "node:crypto";

import type { PrismaClient } from "@prisma/client";

import { seedDemoCatalog } from "./demo-catalog";

const SHOP_NAME = "Apex Restyling";
const TAX_RATE_BPS = 881; // Denver combined sales tax, 8.81%

/**
 * Provisions the org and fills it. Assumes the RBAC catalog and the demo
 * `User` row already exist. Returns the new org id.
 */
export async function seedDemoShop(prisma: PrismaClient, userId: string): Promise<string> {
  const { org, location } = await provisionDemoOrg(prisma, userId);
  await seedDemoCatalog(prisma, org.id);
  await seedDemoData(prisma, org.id, location.id, userId);
  return org.id;
}

const DAY = 24 * 60 * 60 * 1000;
const now = new Date();
function daysFromNow(days: number, hour = 9): Date {
  const d = new Date(now.getTime() + days * DAY);
  d.setHours(hour, 0, 0, 0);
  return d;
}
const dollars = (d: number) => Math.round(d * 100);
const token = () => randomBytes(24).toString("base64url");

// ---------------------------------------------------------------------------
// Org
// ---------------------------------------------------------------------------

async function provisionDemoOrg(prisma: PrismaClient, userId: string) {
  const ownerRole = await prisma.role.findFirst({
    where: { organizationId: null, key: "owner" },
    select: { id: true },
  });
  if (!ownerRole) throw new Error("System roles not seeded. Run `pnpm db:seed` first.");

  return prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: SHOP_NAME,
        slug: `apex-restyling-demo-${randomBytes(3).toString("hex")}`,
        tier: "pro",
        subscriptionStatus: "active",
        settings: {
          demo: true,
          profile: {
            legalName: "Apex Restyling LLC",
            shopPhone: "(303) 555-0142",
            servicesOffered: ["wrap", "ppf", "tint", "ceramic", "detailing"],
            currentSoftware: { scheduling: null, invoicing: null },
            signupCompletedAt: now.toISOString(),
          },
        },
      },
    });
    const location = await tx.location.create({
      data: {
        organizationId: org.id,
        name: "Main",
        addressLine1: "2150 S Broadway",
        city: "Denver",
        region: "CO",
        postalCode: "80210",
        timezone: "America/Denver",
      },
    });
    await tx.orgMember.create({
      data: {
        organizationId: org.id,
        userId,
        roleId: ownerRole.id,
        locationId: location.id,
        status: "active",
      },
    });
    return { org, location };
  });
}

// ---------------------------------------------------------------------------
// Demo data
// ---------------------------------------------------------------------------

type CustomerSeed = {
  name: string;
  email: string;
  phone: string;
  type?: "individual" | "business";
  businessName?: string;
  city?: string;
  tags?: string[];
  referralSource?: string;
  vehicles: Array<{
    year: number;
    make: string;
    model: string;
    trim?: string;
    color: string;
    bodyStyle: string;
    plate: string;
  }>;
};

const CUSTOMERS: CustomerSeed[] = [
  { name: "Marcus Chen", email: "marcus.chen@example.com", phone: "3035550101", tags: ["vip"], referralSource: "instagram",
    vehicles: [{ year: 2024, make: "Porsche", model: "911", trim: "Carrera S", color: "Guards Red", bodyStyle: "coupe", plate: "APX911" }] },
  { name: "Ava Martinez", email: "ava.martinez@example.com", phone: "3035550102", referralSource: "google",
    vehicles: [{ year: 2023, make: "Tesla", model: "Model Y", trim: "Performance", color: "Pearl White", bodyStyle: "suv", plate: "EVAVA1" }] },
  { name: "Devon Reyes", email: "devon.reyes@example.com", phone: "3035550103", referralSource: "referral",
    vehicles: [
      { year: 2022, make: "Ford", model: "F-150", trim: "Raptor", color: "Oxford White", bodyStyle: "truck", plate: "RPTR22" },
      { year: 2019, make: "Toyota", model: "4Runner", trim: "TRD Pro", color: "Army Green", bodyStyle: "suv", plate: "TRD4RN" },
    ] },
  { name: "Priya Patel", email: "priya.patel@example.com", phone: "3035550104", referralSource: "google",
    vehicles: [{ year: 2024, make: "BMW", model: "M4", trim: "Competition", color: "Isle of Man Green", bodyStyle: "coupe", plate: "M4PRYA" }] },
  { name: "Kenji Yamada", email: "kenji.yamada@example.com", phone: "3035550105", tags: ["repeat"], referralSource: "existing_customer",
    vehicles: [{ year: 2023, make: "Toyota", model: "GR Supra", trim: "3.0", color: "Nitro Yellow", bodyStyle: "coupe", plate: "GRSUPR" }] },
  { name: "Sofia Alvarez", email: "sofia.alvarez@example.com", phone: "3035550106", referralSource: "instagram",
    vehicles: [{ year: 2021, make: "Jeep", model: "Wrangler", trim: "Rubicon", color: "Black", bodyStyle: "suv", plate: "JEEPSO" }] },
  { name: "Mile High Plumbing", businessName: "Mile High Plumbing Co.", type: "business", email: "fleet@milehighplumbing.example.com", phone: "3035550107", tags: ["fleet"], referralSource: "fleet",
    vehicles: [
      { year: 2023, make: "Ford", model: "Transit", trim: "250 High Roof", color: "White", bodyStyle: "van", plate: "MHP001" },
      { year: 2023, make: "Ford", model: "Transit", trim: "250 High Roof", color: "White", bodyStyle: "van", plate: "MHP002" },
      { year: 2022, make: "Ram", model: "ProMaster", trim: "2500", color: "White", bodyStyle: "van", plate: "MHP003" },
    ] },
  { name: "Nina Kowalski", email: "nina.k@example.com", phone: "3035550108", referralSource: "walk_in",
    vehicles: [{ year: 2020, make: "Audi", model: "RS5", trim: "Sportback", color: "Nardo Grey", bodyStyle: "sedan", plate: "RS5NIN" }] },
  { name: "Malik Adebayo", email: "malik.adebayo@example.com", phone: "3035550109", tags: ["vip"], referralSource: "referral",
    vehicles: [{ year: 2024, make: "Chevrolet", model: "Corvette", trim: "Z06", color: "Torch Red", bodyStyle: "coupe", plate: "Z06MAL" }] },
  { name: "Zoe Silva", email: "zoe.silva@example.com", phone: "3035550110", referralSource: "facebook",
    vehicles: [{ year: 2022, make: "Honda", model: "Civic", trim: "Type R", color: "Championship White", bodyStyle: "sedan", plate: "CTRZOE" }] },
  { name: "Hugo Ferrari", email: "hugo.ferrari@example.com", phone: "3035550111", referralSource: "dealer",
    vehicles: [{ year: 2024, make: "Rivian", model: "R1S", trim: "Adventure", color: "Forest Green", bodyStyle: "suv", plate: "R1SHUG" }] },
  { name: "Lena O'Brien", email: "lena.obrien@example.com", phone: "3035550112", referralSource: "google",
    vehicles: [{ year: 2021, make: "Mercedes-Benz", model: "G 550", color: "Obsidian Black", bodyStyle: "suv", plate: "GWAGNL" }] },
];

async function seedDemoData(
  prisma: PrismaClient,
  organizationId: string,
  locationId: string,
  userId: string,
) {
  const ownerMember = await prisma.orgMember.findFirstOrThrow({
    where: { organizationId, userId },
    select: { id: true },
  });

  // ---- Bays ----
  const bayDefs = [
    { name: "Bay 1 — Wrap", capabilities: ["wrap", "ppf"] },
    { name: "Bay 2 — PPF", capabilities: ["ppf", "ceramic"] },
    { name: "Bay 3 — Tint", capabilities: ["tint"] },
    { name: "Detail Bay", capabilities: ["detail", "ceramic"] },
  ];
  const bays = [];
  for (const [i, b] of bayDefs.entries()) {
    bays.push(
      await prisma.bay.create({
        data: { organizationId, locationId, sortOrder: i, ...b },
      }),
    );
  }
  console.log(`  ✓ ${bays.length} bays`);

  // ---- Customers + vehicles ----
  const customers: Array<{ id: string; name: string; vehicleIds: string[] }> = [];
  for (const [i, c] of CUSTOMERS.entries()) {
    const customer = await prisma.customer.create({
      data: {
        organizationId,
        type: c.type ?? "individual",
        name: c.name,
        businessName: c.businessName ?? null,
        email: c.email,
        phone: c.phone,
        city: c.city ?? "Denver",
        region: "CO",
        tags: c.tags ?? [],
        referralSource: c.referralSource ?? null,
        marketingConsent: i % 3 !== 0,
        createdAt: daysFromNow(-120 + i * 8),
      },
    });
    const vehicleIds: string[] = [];
    for (const v of c.vehicles) {
      const vehicle = await prisma.vehicle.create({
        data: {
          organizationId,
          customerId: customer.id,
          ...v,
          plateState: "CO",
          mileage: 3000 + ((i * 7919) % 40000),
          createdAt: customer.createdAt,
        },
      });
      vehicleIds.push(vehicle.id);
    }
    customers.push({ id: customer.id, name: c.name, vehicleIds });
  }
  const vehicleCount = customers.reduce((n, c) => n + c.vehicleIds.length, 0);
  console.log(`  ✓ ${customers.length} customers, ${vehicleCount} vehicles`);
  const cust = (name: string) => customers.find((c) => c.name === name)!;

  // ---- Leads (open pipeline) ----
  const leads = [
    { name: "Jordan Blake", email: "jordan.blake@example.com", phone: "7205550201", source: "instagram", status: "new", requestedServices: ["wrap"], vehicleDescription: "2023 Audi RS6 Avant — wants satin black wrap", budgetCents: dollars(6000), createdAt: daysFromNow(0, 8) },
    { name: "Taylor Nguyen", email: "taylor.n@example.com", phone: "7205550202", source: "google", status: "new", requestedServices: ["tint", "ceramic"], vehicleDescription: "2024 Lexus RX 350", createdAt: daysFromNow(-1, 15) },
    { name: "Chris Morgan", email: "chris.morgan@example.com", phone: "7205550203", source: "website", status: "contacted", requestedServices: ["ppf"], vehicleDescription: "2025 Porsche Macan EV — full front PPF", budgetCents: dollars(2500), createdAt: daysFromNow(-2), followUpAt: daysFromNow(1, 10) },
    { name: "Sam Rivera", email: "sam.rivera@example.com", phone: "7205550204", source: "phone", status: "estimate_requested", requestedServices: ["wrap", "ppf"], vehicleDescription: "2022 Lamborghini Urus — color change + PPF", budgetCents: dollars(15000), createdAt: daysFromNow(-3) },
    { name: "Alex Kim", email: "alex.kim@example.com", phone: "7205550205", source: "referral", status: "quote_sent", requestedServices: ["ceramic"], vehicleDescription: "2024 Kia EV9", createdAt: daysFromNow(-5), followUpAt: daysFromNow(0, 14) },
    { name: "Riley Jensen", email: "riley.j@example.com", phone: "7205550206", source: "facebook", status: "follow_up", requestedServices: ["tint"], vehicleDescription: "2020 Subaru WRX", createdAt: daysFromNow(-9), followUpAt: daysFromNow(-1, 11) },
    { name: "Denver Sprinter Rentals", email: "ops@densprinter.example.com", phone: "7205550207", source: "fleet", status: "waiting", requestedServices: ["wrap"], vehicleDescription: "6× Mercedes Sprinter — commercial graphics", budgetCents: dollars(22000), createdAt: daysFromNow(-6) },
    { name: "Morgan Price", email: "morgan.p@example.com", phone: "7205550208", source: "google", status: "lost", requestedServices: ["wrap"], vehicleDescription: "2018 Dodge Charger", notes: "Went with a cheaper shop.", createdAt: daysFromNow(-21) },
  ];
  for (const l of leads) {
    await prisma.lead.create({
      data: { organizationId, locationId, preferredContact: "sms", tags: [], ...l },
    });
  }
  console.log(`  ✓ ${leads.length} leads`);

  // ---- Quotes → jobs → invoices ----
  // Each scenario is one customer engagement at a different point in the
  // lifecycle so every board/list in the app has something to show.
  type Line = { description: string; quantity?: number; unit?: string; unitPrice: number };
  type Scenario = {
    customer: string;
    vehicleIdx?: number;
    lines: Line[];
    quoteStatus: "draft" | "sent" | "viewed" | "approved" | "declined";
    quoteDaysAgo: number;
    job?: {
      status: string;
      title: string;
      bay?: number;
      startDays: number; // relative to today
      durationDays: number;
      estimatedHours: number;
      priority?: string;
    };
    invoice?: { status: "sent" | "partial" | "paid" | "past_due"; paidFraction: number; method?: string };
  };

  const scenarios: Scenario[] = [
    // Delivered + paid — history for reports
    { customer: "Kenji Yamada", lines: [{ description: "Full Color Change Wrap — Inozetek Super Gloss Midnight Purple", unitPrice: 3400 }, { description: "Chrome Delete", unitPrice: 650 }],
      quoteStatus: "approved", quoteDaysAgo: 40,
      job: { status: "delivered", title: "Midnight Purple color change", bay: 0, startDays: -30, durationDays: 4, estimatedHours: 35 },
      invoice: { status: "paid", paidFraction: 1, method: "card" } },
    { customer: "Priya Patel", lines: [{ description: "Full Front PPF — XPEL Ultimate Plus", quantity: 60, unit: "sqft", unitPrice: 32 }, { description: "Ceramic Coating Level 2 (3yr)", unitPrice: 900 }],
      quoteStatus: "approved", quoteDaysAgo: 28,
      job: { status: "delivered", title: "Full front PPF + ceramic", bay: 1, startDays: -18, durationDays: 2, estimatedHours: 14 },
      invoice: { status: "paid", paidFraction: 1, method: "card" } },
    { customer: "Zoe Silva", lines: [{ description: "All-Around Tint — Sedan (LLumar CTX 20%)", unitPrice: 299 }, { description: "Windshield Strip", unitPrice: 99 }],
      quoteStatus: "approved", quoteDaysAgo: 15,
      job: { status: "delivered", title: "Ceramic tint package", bay: 2, startDays: -10, durationDays: 1, estimatedHours: 3 },
      invoice: { status: "paid", paidFraction: 1, method: "cash" } },
    { customer: "Mile High Plumbing", vehicleIdx: 0, lines: [{ description: "Commercial partial wrap — logo + contact graphics", quantity: 2, unitPrice: 1850 }, { description: "Design & proofing", quantity: 3, unit: "hour", unitPrice: 125 }],
      quoteStatus: "approved", quoteDaysAgo: 35,
      job: { status: "delivered", title: "Fleet graphics — Transit vans 1 & 2", bay: 0, startDays: -22, durationDays: 3, estimatedHours: 24 },
      invoice: { status: "past_due", paidFraction: 0 } },
    { customer: "Nina Kowalski", lines: [{ description: "Ceramic Coating Level 3 (5yr)", unitPrice: 1400 }, { description: "Wash & Decon (Pre-install prep)", unitPrice: 150 }],
      quoteStatus: "approved", quoteDaysAgo: 12,
      job: { status: "delivered", title: "5-year ceramic", bay: 3, startDays: -6, durationDays: 2, estimatedHours: 12 },
      invoice: { status: "partial", paidFraction: 0.5, method: "card" } },

    // In the shop right now
    { customer: "Marcus Chen", lines: [{ description: "Full Body PPF — XPEL Stealth (matte)", quantity: 220, unit: "sqft", unitPrice: 32 }, { description: "Wheel + Caliper Coating", unitPrice: 299 }],
      quoteStatus: "approved", quoteDaysAgo: 14,
      job: { status: "in_progress", title: "Full body Stealth PPF", bay: 1, startDays: -2, durationDays: 5, estimatedHours: 42, priority: "high" } },
    { customer: "Devon Reyes", lines: [{ description: "Chrome Delete", unitPrice: 800 }, { description: "Ceramic Tint — SUV/Truck", unitPrice: 499 }],
      quoteStatus: "approved", quoteDaysAgo: 9,
      job: { status: "qc", title: "Raptor chrome delete + tint", bay: 2, startDays: -1, durationDays: 2, estimatedHours: 8 } },
    { customer: "Ava Martinez", lines: [{ description: "Full Color Change Wrap — 3M 2080 Satin Black", unitPrice: 4200 }],
      quoteStatus: "approved", quoteDaysAgo: 11,
      job: { status: "prep", title: "Satin black Model Y", bay: 0, startDays: 0, durationDays: 4, estimatedHours: 32 } },
    { customer: "Sofia Alvarez", lines: [{ description: "Partial Wrap (Roof + Hood + Mirrors)", unitPrice: 1500 }],
      quoteStatus: "approved", quoteDaysAgo: 8,
      job: { status: "checked_in", title: "Gloss black roof + hood", bay: 3, startDays: 0, durationDays: 2, estimatedHours: 10 } },
    { customer: "Hugo Ferrari", lines: [{ description: "Full Front PPF — SunTek Ultra", quantity: 60, unit: "sqft", unitPrice: 30 }, { description: "Headlight PPF", unitPrice: 199 }],
      quoteStatus: "approved", quoteDaysAgo: 7,
      job: { status: "ready_for_pickup", title: "R1S front PPF", bay: 1, startDays: -3, durationDays: 2, estimatedHours: 9 },
      invoice: { status: "sent", paidFraction: 0 } },

    // Upcoming on the schedule
    { customer: "Malik Adebayo", lines: [{ description: "Track Pack PPF — XPEL Ultimate Plus", quantity: 90, unit: "sqft", unitPrice: 30 }, { description: "Ceramic Coating Level 3 (5yr)", unitPrice: 1400 }],
      quoteStatus: "approved", quoteDaysAgo: 6,
      job: { status: "scheduled", title: "Z06 track pack + ceramic", bay: 1, startDays: 2, durationDays: 3, estimatedHours: 22, priority: "high" } },
    { customer: "Mile High Plumbing", vehicleIdx: 2, lines: [{ description: "Commercial partial wrap — logo + contact graphics", unitPrice: 1850 }],
      quoteStatus: "approved", quoteDaysAgo: 5,
      job: { status: "scheduled", title: "Fleet graphics — ProMaster", bay: 0, startDays: 4, durationDays: 2, estimatedHours: 12 } },
    { customer: "Devon Reyes", vehicleIdx: 1, lines: [{ description: "All-Around Tint — SUV (LLumar CTX 35%)", unitPrice: 499 }],
      quoteStatus: "approved", quoteDaysAgo: 3,
      job: { status: "ready", title: "4Runner tint", startDays: 6, durationDays: 1, estimatedHours: 3 } },

    // Open quotes, no job yet
    { customer: "Lena O'Brien", lines: [{ description: "Full Color Change Wrap — Avery SW900 Dark Basalt", unitPrice: 6500 }, { description: "Chrome Delete", unitPrice: 800 }],
      quoteStatus: "viewed", quoteDaysAgo: 2 },
    { customer: "Kenji Yamada", lines: [{ description: "Full Front PPF — STEK Dynoshield", quantity: 60, unit: "sqft", unitPrice: 32 }],
      quoteStatus: "sent", quoteDaysAgo: 1 },
    { customer: "Nina Kowalski", lines: [{ description: "Full Windshield Ceramic", unitPrice: 349 }],
      quoteStatus: "draft", quoteDaysAgo: 0 },
    { customer: "Zoe Silva", lines: [{ description: "Racing Stripes", unitPrice: 650 }],
      quoteStatus: "declined", quoteDaysAgo: 20 },
  ];

  let quoteNo = 1001;
  let jobNo = 1;
  let invoiceNo = 5001;
  let jobCount = 0;
  let invoiceCount = 0;

  for (const s of scenarios) {
    const c = cust(s.customer);
    const vehicleId = c.vehicleIds[s.vehicleIdx ?? 0];
    const lines = s.lines.map((l, i) => {
      const quantity = l.quantity ?? 1;
      const unitPriceCents = dollars(l.unitPrice);
      return {
        organizationId,
        sortOrder: i,
        description: l.description,
        quantity,
        unit: l.unit ?? "each",
        unitPriceCents,
        totalCents: Math.round(quantity * unitPriceCents),
        taxable: true,
      };
    });
    const subtotalCents = lines.reduce((n, l) => n + l.totalCents, 0);
    const taxCents = Math.round((subtotalCents * TAX_RATE_BPS) / 10000);
    const totalCents = subtotalCents + taxCents;
    const depositPercent = 25;
    const createdAt = daysFromNow(-s.quoteDaysAgo, 10);
    const isSent = s.quoteStatus !== "draft";

    const quote = await prisma.quote.create({
      data: {
        organizationId,
        customerId: c.id,
        vehicleId,
        number: quoteNo++,
        status: s.quoteStatus,
        portalToken: token(),
        subtotalCents,
        taxCents,
        taxRateBps: TAX_RATE_BPS,
        totalCents,
        depositPercent,
        depositCents: Math.round(totalCents * (depositPercent / 100)),
        terms: "25% deposit to schedule. Balance due at pickup.",
        expiresAt: new Date(createdAt.getTime() + 30 * DAY),
        sentAt: isSent ? createdAt : null,
        viewedAt: ["viewed", "approved", "declined"].includes(s.quoteStatus)
          ? new Date(createdAt.getTime() + DAY / 4)
          : null,
        approvedAt: s.quoteStatus === "approved" ? new Date(createdAt.getTime() + DAY) : null,
        declinedAt: s.quoteStatus === "declined" ? new Date(createdAt.getTime() + DAY) : null,
        declinedReason: s.quoteStatus === "declined" ? "Decided to wait until spring." : null,
        signatureName: s.quoteStatus === "approved" ? s.customer : null,
        acceptedTermsAt: s.quoteStatus === "approved" ? new Date(createdAt.getTime() + DAY) : null,
        createdByUserId: userId,
        createdAt,
        items: { create: lines },
      },
    });

    if (!s.job) continue;
    const j = s.job;
    const start = daysFromNow(j.startDays, 8);
    const end = daysFromNow(j.startDays + j.durationDays - 1, 17);
    const started = ["checked_in", "prep", "in_progress", "qc", "ready_for_pickup", "delivered"].includes(j.status);
    const finished = ["ready_for_pickup", "delivered"].includes(j.status);

    const job = await prisma.job.create({
      data: {
        organizationId,
        locationId,
        number: jobNo++,
        quoteId: quote.id,
        customerId: c.id,
        vehicleId,
        bayId: j.bay === undefined ? null : bays[j.bay]!.id,
        status: j.status,
        priority: j.priority ?? "normal",
        title: j.title,
        summary: s.lines.map((l) => l.description).join("; "),
        assignedTechIds: [ownerMember.id],
        scheduledStart: start,
        scheduledEnd: end,
        actualStart: started ? start : null,
        actualEnd: finished ? end : null,
        deliveredAt: j.status === "delivered" ? new Date(end.getTime() + DAY / 2) : null,
        estimatedHours: j.estimatedHours,
        actualHours: finished ? Math.round(j.estimatedHours * 1.08 * 10) / 10 : null,
        createdByUserId: userId,
        createdAt: quote.approvedAt ?? createdAt,
      },
    });
    jobCount++;

    if (!s.invoice) continue;
    const inv = s.invoice;
    const amountPaidCents = Math.round(totalCents * inv.paidFraction);
    const sentAt = new Date(end.getTime() + DAY / 2);
    const invoice = await prisma.invoice.create({
      data: {
        organizationId,
        customerId: c.id,
        jobId: job.id,
        quoteId: quote.id,
        number: invoiceNo++,
        status: inv.status,
        subtotalCents,
        taxCents,
        totalCents,
        amountPaidCents,
        balanceCents: totalCents - amountPaidCents,
        dueDate: new Date(sentAt.getTime() + 14 * DAY),
        sentAt,
        paidAt: inv.status === "paid" ? sentAt : null,
        createdByUserId: userId,
        createdAt: sentAt,
        items: {
          create: lines.map(({ sortOrder, description, quantity, unit, unitPriceCents, totalCents, taxable }) => ({
            organizationId,
            sortOrder,
            description,
            quantity,
            unit,
            unitPriceCents,
            totalCents,
            taxable,
          })),
        },
      },
    });
    if (amountPaidCents > 0) {
      await prisma.payment.create({
        data: {
          organizationId,
          invoiceId: invoice.id,
          customerId: c.id,
          amountCents: amountPaidCents,
          method: inv.method ?? "card",
          receivedAt: sentAt,
          recordedByUserId: userId,
        },
      });
    }
    invoiceCount++;
  }
  console.log(`  ✓ ${scenarios.length} quotes, ${jobCount} jobs, ${invoiceCount} invoices`);
}

