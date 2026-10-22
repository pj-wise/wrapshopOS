/**
 * Seed script — populates the RBAC catalog (Permission + system Role rows).
 *
 * Idempotent. Runs on `pnpm db:seed` or automatically via Prisma's seed hook.
 *
 * Note: this seeds catalog data only. A separate "demo shop" seeder in Phase 4
 * will create a realistic "Apex Restyling — Denver, CO" organization with
 * customers, vehicles, services, materials, and jobs. Keep them separate so
 * production deploys can run this seed without demo data.
 */

import { PrismaClient } from "@prisma/client";

import { seedRbacCatalog } from "../src/server/seed/rbac";

const prisma = new PrismaClient();

seedRbacCatalog(prisma)
  .then(() => {
    console.log("Seed complete.");
    return prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
