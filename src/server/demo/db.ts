import "server-only";

import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { PrismaClient } from "@prisma/client";

import { DEMO_EMAIL, DEMO_NAME, DEMO_USER_ID } from "@/lib/demo";
import { seedDemoShop } from "@/server/seed/demo-shop";
import { seedRbacCatalog } from "@/server/seed/rbac";

const MIGRATIONS_DIR = path.join(process.cwd(), "prisma", "migrations");

/**
 * Prisma client backed by an in-memory PGlite database, for demo mode.
 *
 * PGlite is served over the Postgres wire protocol on a per-process Unix
 * socket, so Prisma talks to it through its normal query engine (the PGlite
 * driver adapter lacks types we use, e.g. `uuid[]`). A unique socket dir per
 * process means dev, `next start`, and build workers never collide.
 *
 * Nothing starts until the first query: it then applies every migration and
 * seeds the RBAC catalog, the demo user, and the demo shop, and every query
 * waits for that to finish. Data lives only in this process — it resets on
 * restart (and on every serverless cold start), which is what a demo wants.
 */
export function createDemoPrismaClient(): PrismaClient {
  const socketDir = mkdtempSync(path.join(os.tmpdir(), "wrapshop-demo-"));
  const base = new PrismaClient({
    // The engine only supports one PGlite connection at a time.
    datasourceUrl: `postgresql://postgres@localhost:5432/postgres?host=${socketDir}&connection_limit=1`,
  });

  let ready: Promise<void> | undefined;
  async function start() {
    const started = Date.now();
    const pg = new PGlite({ extensions: { pg_trgm, pgcrypto, unaccent } });
    const migrations = readdirSync(MIGRATIONS_DIR)
      .filter((dir) => /^\d/.test(dir))
      .sort();
    for (const dir of migrations) {
      await pg.exec(readFileSync(path.join(MIGRATIONS_DIR, dir, "migration.sql"), "utf8"));
    }
    await new PGLiteSocketServer({ db: pg, path: path.join(socketDir, ".s.PGSQL.5432") }).start();

    await seedRbacCatalog(base);
    await base.user.create({
      data: { id: DEMO_USER_ID, email: DEMO_EMAIL, name: DEMO_NAME },
    });
    await seedDemoShop(base, DEMO_USER_ID);
    console.log(`[demo] in-memory database ready in ${Date.now() - started} ms`);
  }

  return base.$extends({
    query: {
      async $allOperations({ args, query }) {
        ready ??= start().catch((err) => {
          ready = undefined; // let the next request retry
          throw err;
        });
        await ready;
        return query(args);
      },
    },
  }) as unknown as PrismaClient;
}
