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

import { seedDemoCatalog } from "../src/server/seed/demo-catalog";

const prisma = new PrismaClient();

async function main() {
  const orgArgIdx = process.argv.indexOf("--org-id");
  if (orgArgIdx === -1 || !process.argv[orgArgIdx + 1]) {
    throw new Error("Usage: pnpm exec tsx prisma/seed-demo-catalog.ts --org-id <uuid>");
  }
  const organizationId = process.argv[orgArgIdx + 1];

  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!org) throw new Error(`Organization ${organizationId} not found.`);
  console.log(`Seeding demo catalog for org "${org.name}" (${organizationId})`);

  await seedDemoCatalog(prisma, organizationId);
  console.log("\nDemo catalog seeded. Head to /admin/settings/services + /inventory to browse.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
