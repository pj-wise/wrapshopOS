import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();
  const orgs = await p.organization.findMany({ select: { id: true, name: true, slug: true } });
  for (const o of orgs) console.log(`${o.id}  ${o.name}  (${o.slug})`);
  await p.$disconnect();
}

main();
