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

import {
  PERMISSIONS,
  SYSTEM_ROLES,
  permissionsForSystemRole,
} from "../src/lib/permissions";

const prisma = new PrismaClient();

async function main() {
  console.log("→ Seeding Permission catalog");
  await prisma.$transaction(
    PERMISSIONS.map((p) =>
      prisma.permission.upsert({
        where: { key: p.key },
        create: { key: p.key, category: p.category, description: p.description },
        update: { category: p.category, description: p.description },
      }),
    ),
  );
  console.log(`  ✓ ${PERMISSIONS.length} permissions upserted`);

  console.log("→ Seeding system Role catalog (organizationId = NULL)");
  for (const roleDef of SYSTEM_ROLES) {
    // Postgres treats NULL as non-equal in unique constraints, so upsert-by-
    // compound (organizationId=NULL, key) won't work. Use findFirst + create/update.
    const existing = await prisma.role.findFirst({
      where: { organizationId: null, key: roleDef.key },
    });
    const role = existing
      ? await prisma.role.update({
          where: { id: existing.id },
          data: {
            name: roleDef.name,
            description: roleDef.description,
            isSystem: true,
          },
        })
      : await prisma.role.create({
          data: {
            organizationId: null,
            key: roleDef.key,
            name: roleDef.name,
            description: roleDef.description,
            isSystem: true,
          },
        });

    // Wipe + reinsert this role's permission mappings so they match the catalog.
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    const perms = permissionsForSystemRole(roleDef.key);
    if (perms.length > 0) {
      await prisma.rolePermission.createMany({
        data: perms.map((permissionKey) => ({ roleId: role.id, permissionKey })),
        skipDuplicates: true,
      });
    }
    console.log(`  ✓ ${roleDef.name} — ${perms.length} permissions`);
  }
}

main()
  .then(() => {
    console.log("Seed complete.");
    return prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
