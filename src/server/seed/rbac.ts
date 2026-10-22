/**
 * RBAC catalog seeder — Permission + system Role rows. Idempotent.
 *
 * Shared by `prisma/seed.ts` and the in-memory demo database.
 */

import type { PrismaClient } from "@prisma/client";

import {
  PERMISSIONS,
  SYSTEM_ROLES,
  permissionsForSystemRole,
} from "@/lib/permissions";

export async function seedRbacCatalog(prisma: PrismaClient) {
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
