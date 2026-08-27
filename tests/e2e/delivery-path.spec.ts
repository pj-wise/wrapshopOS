import { test, expect } from "@playwright/test";

/**
 * Delivery-path E2E — the plan's gate test.
 *
 * Uses two browser contexts:
 *   1. Shop staff: creates customer + vehicle by VIN + quote + sends
 *   2. Customer (incognito): opens the portal magic-link URL + approves + signs
 *   3. Shop staff again: verifies job auto-created, checks in the vehicle,
 *      walks status to Delivered, verifies invoice + payment reconciliation.
 *
 * SIGN-IN: this test assumes a valid Supabase magic-link session is present
 * for the shop-staff context. In CI we bypass by seeding a session cookie
 * (see `authenticatedContext` fixture). For local runs, sign in manually
 * first and re-use the storage state via:
 *
 *   pnpm exec playwright codegen --save-storage=tests/e2e/.auth/shop.json http://localhost:3000
 *
 * The path below `.skip`s automatically if no storage state is available so
 * `pnpm test:e2e` doesn't fail in fresh clones.
 */

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const AUTH_STATE = resolve(here, ".auth/shop.json");
const HAS_SESSION = existsSync(AUTH_STATE);

test.describe("delivery path (shop + customer)", () => {
  test.skip(!HAS_SESSION, "no saved auth state — see delivery-path.spec.ts docs");

  test.use({ storageState: HAS_SESSION ? AUTH_STATE : undefined });

  test("customer → vehicle → quote → approve → job → deliver → invoice → paid", async ({
    page,
    browser,
  }) => {
    const suffix = Math.random().toString(36).slice(2, 8);
    const customerName = `E2E Customer ${suffix}`;
    const customerEmail = `e2e+${suffix}@example.com`;
    const vin = "1FTFW1E80RFA12345"; // real Ford VIN, NHTSA decodes

    // ---- 1. Create customer ----
    await page.goto("/customers");
    await page.getByRole("button", { name: /new customer/i }).click();
    await page.getByLabel(/full name|company name/i).fill(customerName);
    await page.getByLabel(/^email$/i).fill(customerEmail);
    await page.getByRole("button", { name: /create customer/i }).click();
    await expect(page).toHaveURL(/\/customers\/[0-9a-f-]{36}/);
    const customerUrl = page.url();
    const customerId = customerUrl.split("/customers/")[1];
    expect(customerId).toBeTruthy();

    // ---- 2. Add vehicle by VIN ----
    await page.getByRole("tab", { name: /vehicles/i }).click();
    await page.getByRole("button", { name: /add vehicle/i }).click();
    await page.getByLabel(/vin/i).fill(vin);
    await page.getByRole("button", { name: /^decode$/i }).click();
    await expect(page.getByText(/decoded — review and adjust/i)).toBeVisible();
    await page.getByRole("button", { name: /save vehicle/i }).click();
    await expect(page.getByText(/2024 FORD F-150/i)).toBeVisible();

    // ---- 3. Build + send a quote ----
    await page.goto(`/quotes/new?customerId=${customerId}`);
    // Pick the first service from the catalog picker.
    const catalogPicker = page.getByRole("combobox", { name: /from catalog/i }).first();
    await catalogPicker.click();
    await page.getByRole("option").first().click();
    await page.getByRole("button", { name: /save \+ send/i }).click();
    await expect(page).toHaveURL(/\/quotes\/[0-9a-f-]{36}/);

    // Grab the portal link.
    const portalLinkEl = page.locator("code, .font-mono").filter({ hasText: /\/q\// });
    const portalLink = await portalLinkEl.first().textContent();
    expect(portalLink).toMatch(/\/q\/[A-Za-z0-9_-]+/);

    // ---- 4. Customer approves via portal (fresh incognito context) ----
    const customerCtx = await browser.newContext();
    const customerPage = await customerCtx.newPage();
    await customerPage.goto(portalLink!.trim());
    await customerPage.getByRole("button", { name: /approve & sign/i }).click();
    await customerPage.getByLabel(/full name/i).fill(customerName);
    await customerPage.getByLabel(/agree to the terms/i).check();
    await customerPage.getByRole("button", { name: /sign & approve/i }).click();
    await expect(customerPage.getByText(/^approved$/i)).toBeVisible();
    await customerCtx.close();

    // ---- 5. Job auto-created (Inngest fn) — poll the jobs list up to 10s ----
    const jobRow = page.getByText(`J-`, { exact: false }).first();
    let jobFound = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      await page.goto("/jobs");
      if (await jobRow.isVisible().catch(() => false)) {
        jobFound = true;
        break;
      }
      await page.waitForTimeout(500);
    }
    expect(jobFound, "Expected a Job to auto-create from the approved quote").toBeTruthy();

    // ---- 6. Open the newest job, check in, deliver ----
    await page.locator("a[href^='/jobs/']").first().click();
    await expect(page).toHaveURL(/\/jobs\/[0-9a-f-]{36}/);
    await page.getByRole("tab", { name: /check-in/i }).click();
    await page.getByLabel(/mileage/i).fill("12340");
    await page.getByLabel(/customer signature/i).fill(customerName);
    await page
      .getByRole("button", { name: /complete check-in|update check-in/i })
      .click();

    // Walk stage-advance buttons to Delivered.
    await page.getByRole("button", { name: /start prep/i }).click();
    await page.getByRole("button", { name: /start install/i }).click();
    await page.getByRole("button", { name: /send to qc/i }).click();
    await page.getByRole("tab", { name: /qc/i }).click();
    await page.getByRole("button", { name: /submit qc/i }).click();
    await page.getByRole("button", { name: /mark delivered/i }).click();
    await expect(page.getByText(/delivered/i).first()).toBeVisible();

    // ---- 7. Invoice auto-created — record cash payment ----
    for (let attempt = 0; attempt < 20; attempt++) {
      await page.goto("/invoices");
      if (
        await page
          .locator("a[href^='/invoices/']")
          .first()
          .isVisible()
          .catch(() => false)
      ) {
        break;
      }
      await page.waitForTimeout(500);
    }
    await page.locator("a[href^='/invoices/']").first().click();
    await page.getByRole("button", { name: /^record payment$/i }).click();
    await page.getByRole("button", { name: /^record$/i }).click();
    await expect(page.getByText(/^paid$/i).first()).toBeVisible();
  });
});
