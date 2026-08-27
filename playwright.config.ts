import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config — assumes a dev server is already running on
 * http://localhost:3000. Run:
 *
 *   pnpm dev            # in one terminal
 *   pnpm test:e2e        # in another
 *
 * We deliberately do NOT auto-start the dev server here: HMR + tRPC + Supabase
 * pooler take 3–5s to warm on cold start, and CI treats that as flakiness.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // multi-tenant data collisions if we run in parallel against one DB
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
