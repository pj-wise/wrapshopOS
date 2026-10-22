/**
 * Demo account seeder — creates a login-ready demo user that owns a fully
 * populated shop ("Apex Restyling — Denver, CO") for sales demos.
 *
 *   Login: demo@nymbl.com / nymbl
 *
 Creates (or resets the password of) the Supabase auth user, then seeds the
 * shop via `seedDemoShop`. For a demo without Supabase at all, set
 * `NEXT_PUBLIC_DEMO_MODE=true` instead (see src/lib/demo.ts).
 *
 * Re-running without --fresh only resets the password; --fresh wipes the demo
 * org and rebuilds it (use before a demo to refresh dates).
 *
 * Run (requires `pnpm db:seed` to have been run once for system roles):
 *   pnpm exec tsx prisma/seed-demo-account.ts
 *   pnpm exec tsx prisma/seed-demo-account.ts --fresh
 */

import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

import { DEMO_EMAIL, DEMO_NAME, DEMO_PASSWORD } from "../src/lib/demo";
import { seedDemoShop } from "../src/server/seed/demo-shop";

// tsx doesn't load env files; Next does. Prefer .env.local like `next dev`.
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // missing file is fine
  }
}

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Auth user
// ---------------------------------------------------------------------------

async function ensureAuthUser(): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  }
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const existing = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password: DEMO_PASSWORD,
      email_confirm: true,
    });
    if (error) throw explainAuthError(error);
    console.log(`  ✓ auth user exists (${existing.id}) — password reset`);
    return existing.id;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { name: DEMO_NAME },
  });
  if (error) throw explainAuthError(error);
  const id = data.user.id;

  // The `on_auth_user_created` trigger normally mirrors this; upsert in case
  // it hasn't fired (or isn't installed in this environment).
  await prisma.user.upsert({
    where: { id },
    create: { id, email: DEMO_EMAIL, name: DEMO_NAME },
    update: { name: DEMO_NAME },
  });
  console.log(`  ✓ auth user created (${id})`);
  return id;
}

function explainAuthError(error: { message: string }): Error {
  if (/password/i.test(error.message)) {
    return new Error(
      `${error.message}\n  "${DEMO_PASSWORD}" is ${DEMO_PASSWORD.length} characters. Lower ` +
        "Authentication → Providers → Email → Minimum password length in the " +
        "Supabase dashboard, then re-run.",
    );
  }
  return new Error(error.message);
}

// ---------------------------------------------------------------------------
// Org
// ---------------------------------------------------------------------------

async function wipeOrg(organizationId: string) {
  // Customer/Quote relations are RESTRICT, so clear dependents before the
  // cascading org delete.
  await prisma.payment.deleteMany({ where: { organizationId } });
  await prisma.invoice.deleteMany({ where: { organizationId } });
  await prisma.job.deleteMany({ where: { organizationId } });
  await prisma.quote.deleteMany({ where: { organizationId } });
  await prisma.organization.delete({ where: { id: organizationId } });
}

// ---------------------------------------------------------------------------

async function main() {
  const fresh = process.argv.includes("--fresh");

  console.log(`→ Demo auth user (${DEMO_EMAIL})`);
  const userId = await ensureAuthUser();

  const membership = await prisma.orgMember.findFirst({
    where: { userId, status: "active" },
    select: { organizationId: true },
  });
  if (membership && !fresh) {
    console.log(
      `\nDemo org already exists (${membership.organizationId}). Re-run with --fresh to rebuild it.`,
    );
    return;
  }
  if (membership) {
    console.log("→ Wiping existing demo org");
    await wipeOrg(membership.organizationId);
  }

  console.log("→ Seeding demo shop");
  const orgId = await seedDemoShop(prisma, userId);
  console.log(`  ✓ org ${orgId}`);

  console.log(`\nDone. Sign in at /login with ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err instanceof Error ? err.message : err);
    await prisma.$disconnect();
    process.exit(1);
  });
