# WrapShop OS

Shop-management PWA for automotive restyling businesses — vinyl wraps, PPF, tint, ceramic coating. Multi-tenant, QuickBooks-first billing, provider-abstracted so any external API is swappable.

## What's inside

The full ~26-week plan lives at `~/.claude/plans/external-api-steady-lake.md`. High-level module map:

- **Phase 1 — Foundation:** Next 16 App Router + React 19 + TS + Tailwind 4 + shadcn, Supabase Auth + Prisma 6 + Postgres, RLS + `db.forOrg()` tenant guard, feature flags first-class, RBAC in DB
- **Phase 2 — Infra:** tRPC v11, Inngest jobs, Serwist-free PWA (manifest + hand-rolled SW), provider abstractions (NHTSA / Resend / Supabase Storage real; SMS / AI / Plate / Address / Pattern noop)
- **Phase 3 — CRM:** Leads → Customers → Vehicles with NHTSA VIN decode, unified timeline, global FTS + trigram search wired into the kbar palette
- **Phase 4 — Catalog + Quoting + Portal:** ServiceCategory + Service + Material + MaterialRoll + Vendor, `PricingEngine` (flat / coverage / hourly / matrix, 22 unit tests), quote builder with upsells, magic-link customer portal with typed-name e-sign
- **Phase 5 — Production + Scheduling:** Job Kanban with drag-drop, work orders + checklists, check-in with condition report + signature, QC + punch list, bay + tech scheduling
- **Phase 6 — Comms + Uploads:** Unified inbox with mustache-safe templates, notification bell, direct-to-storage photo uploader with sharp thumbnail processing
- **Phase 7 — Inventory + Reports + Warranties:** Roll deduction ledger, 5 core reports, auto warranty + aftercare + review request on delivery
- **Phase 8 — QuickBooks:** OAuth (AES-GCM-encrypted tokens), auto-invoice on delivery, `QuickBooksAccountingProvider`, webhook reconciliation, token refresh cron
- **Phase 9 — Hardening:** Playwright delivery-path E2E, load-test seeder, Sentry, live dashboard, landing + pricing

## Tech stack

| Layer            | Choice                                                         |
| ---------------- | -------------------------------------------------------------- |
| Framework        | Next.js 16 App Router (Turbopack), React 19                    |
| Language         | TypeScript                                                     |
| Styling          | Tailwind CSS v4 + shadcn/ui + Inter + JetBrains Mono           |
| Auth             | Supabase Auth (magic link)                                     |
| Database         | Supabase Postgres + Prisma 6 ORM                                |
| API              | tRPC v11 with `orgProcedure` tenant guard                       |
| Background jobs  | Inngest v3                                                     |
| File storage     | Supabase Storage (behind `StorageProvider` interface)          |
| PWA              | Hand-rolled service worker at `public/sw.js` (Turbopack-safe)   |
| Testing          | Vitest (unit) + Playwright (E2E)                                |
| Deployment       | Vercel + Supabase                                              |
| Errors           | Sentry (optional; wire `SENTRY_DSN`)                            |
| External APIs    | NHTSA vPIC · Resend · Cloudflare R2 (later) · QuickBooks Online |

## Local setup (first-time)

Prereqs: **Node ≥ 20.9**, **pnpm** (via `npm i -g pnpm` or corepack), **git**, a **Supabase project** (free tier is fine).

```bash
# 1. Install dependencies
pnpm install

# 2. Copy env template + fill in Supabase URL + keys + DB URLs
cp .env.example .env.local
# Also symlink for Prisma CLI (which reads .env, not .env.local):
ln -sf .env.local .env

# 3. Generate encryption key for OAuth tokens (Phase 8)
openssl rand -hex 32
# → put the output as ENCRYPTION_KEY in .env.local

# 4. Migrate the database
pnpm db:migrate

# 5. Apply per-phase SQL (RLS + trigger + FTS). Idempotent — safe to re-run.
pnpm exec prisma db execute --file prisma/sql/rls-phase1.sql --schema prisma/schema.prisma
# Phase 3–8 SQL migrations are already inside prisma/migrations/*/migration.sql
# (baseline'd; no need to run separately).

# 6. Seed the permission/role catalog
pnpm db:seed

# 7. Optional: seed a realistic demo catalog into your first org
pnpm exec tsx scripts/list-orgs.ts
# → copy the UUID
pnpm exec tsx prisma/seed-demo-catalog.ts --org-id <uuid>

# 8. Start dev server
pnpm dev
# → http://localhost:3000
```

First login: click Get started → email → magic link → onboarding creates your first Organization + default Location + Owner membership.

## Environment variables

Required minimum (see `.env.example` for the annotated full list):

```
DATABASE_URL              Supabase pooler URL (port 6543, pgbouncer=true)
DIRECT_URL                Supabase session pooler URL (port 5432) — Prisma migrate only
NEXT_PUBLIC_SUPABASE_URL  https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ENCRYPTION_KEY            32-byte hex (openssl rand -hex 32)
NEXT_PUBLIC_APP_URL       Public app URL — used in email links + OAuth redirects
```

Optional integrations (features auto-degrade to noop / disabled when missing):

```
# Email (Phase 6 + 8 delivery)
RESEND_API_KEY / RESEND_WEBHOOK_SECRET / EMAIL_FROM

# QuickBooks (Phase 8)
QBO_CLIENT_ID / QBO_CLIENT_SECRET / QBO_WEBHOOK_VERIFIER / QBO_ENVIRONMENT

# Background jobs — only needed on Vercel (local dev works without)
INNGEST_EVENT_KEY / INNGEST_SIGNING_KEY

# Observability
SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN
```

## Common commands

```bash
pnpm dev                          # start dev server (Turbopack)
pnpm typecheck                    # tsc --noEmit
pnpm test                         # vitest unit tests
pnpm test:e2e                     # playwright — see notes below
pnpm build                        # production build (also runs typecheck)

pnpm db:migrate                   # prisma migrate dev — pick up new schema changes
pnpm db:studio                    # prisma studio at localhost:5555
pnpm db:seed                      # permission + system-role catalog

pnpm exec tsx scripts/list-orgs.ts                              # list orgs by id
pnpm exec tsx prisma/seed-demo-catalog.ts --org-id <uuid>       # realistic services + materials
pnpm exec tsx prisma/seed-load-test.ts --org-id <uuid>          # 500 customers + 1000 vehicles + 200 jobs
pnpm exec tsx prisma/seed-load-test.ts --org-id <uuid> --fresh  # wipe LT rows first
```

## Runbook

### Adding a new domain model
1. Add a Prisma model in `prisma/schema.prisma` with `organizationId` + `createdAt/updatedAt` + `deletedAt?`.
2. Add back-refs on `Organization` (+ Customer / Job / etc. as appropriate).
3. `pnpm db:migrate --name <descriptive>`.
4. If the table is org-scoped, add a `CREATE POLICY tenant_isolation` block to a Phase-N SQL file **and** commit it as `prisma/migrations/YYYYMMDDHHMMSS_rls_phaseN/migration.sql` (so the shadow DB replays it).
5. If it needs FTS, add a generated `search tsvector` column (STORED) and declare it in Prisma as `search Unsupported("tsvector")? @default(dbgenerated())` so future migrations don't try to strip it.
6. Add a tRPC router in `src/server/trpc/routers/` and mount it in `root.ts`.

### Running Inngest locally
```bash
pnpm dlx inngest-cli@latest dev -u http://localhost:3000/api/inngest
# Dashboard at http://localhost:8288
```
This is optional — jobs fire and register regardless; the dashboard just gives you retry inspection.

### QuickBooks sandbox setup
1. https://developer.intuit.com → create a Sandbox app → Keys & OAuth.
2. Add redirect URI: `http://localhost:3000/api/oauth/quickbooks/callback` (add prod too when deploying).
3. Copy Client ID + Secret + Webhook Verifier into `.env.local`.
4. Restart dev → `/admin/integrations` → Connect QuickBooks → consent → done.
5. Deliver a job → invoice auto-syncs; open the invoice in QBO sandbox to see it.

### Backups (Supabase)
- Free tier: daily automatic backups, 7-day retention. No PITR.
- Pro tier: PITR (up to 7 days), daily automatic backups (30-day retention).
- To enable PITR: Supabase Dashboard → Project → Database → Backups → Point in Time Recovery.
- The RLS `on_auth_user_created` trigger is idempotent so restore-then-replay is safe.

### Playwright E2E
The delivery-path test needs a signed-in Supabase session. First run:
```bash
pnpm exec playwright codegen --save-storage=tests/e2e/.auth/shop.json http://localhost:3000
# sign in via magic link, then close the browser
pnpm test:e2e
```
Without the saved state the test auto-skips (rather than failing) so `pnpm test:e2e` stays green in fresh clones.

### Feature flags
Everything is in `src/lib/features.ts` (source of truth). Toggle per-org via `feature_overrides` rows or the `features.setOverride` tRPC mutation (admin-only).

## Deployment (Vercel)

1. Push repo to GitHub.
2. Import into Vercel → Framework: Next.js → Add all env vars from `.env.local` (server-side + `NEXT_PUBLIC_*`).
3. Vercel auto-detects the build command. Set Node version = 20+.
4. First deploy will run `next build` + `prisma generate` on the fly.
5. Add production Supabase auth redirect URL in Supabase → Authentication → URL Configuration:
   - Site URL: `https://your-app.vercel.app`
   - Redirect URL: `https://your-app.vercel.app/auth/callback`
6. Update `NEXT_PUBLIC_APP_URL` env var to the Vercel URL (or your custom domain).
7. For Inngest: link the Vercel deployment in the Inngest dashboard so cron jobs actually fire.

## Contributing

Solo build for now, but the architecture is deliberately conventional:
- Feature branches, PR to `main`.
- Prefer editing existing files.
- Never commit `.env.local` or `.env` (both gitignored).
- Every mutation must go through an `orgProcedure` — the `db.forOrg()` guard auto-scopes queries; bare `prisma` is discouraged (eslint-warned).

## License

Proprietary. All rights reserved.
