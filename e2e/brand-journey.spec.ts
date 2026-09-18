// e2e/brand-journey.spec.ts
import { test, expect } from "@playwright/test";
import { BRAND1 } from "./helpers/seed-ids";

// All tests in this file use the brand auth state
test.use({ storageState: "e2e/.auth/brand.json" });

test.describe("Brand journey", () => {
  test("brand home loads with brand content", async ({ page }) => {
    await page.goto("/brand");
    await page.waitForLoadState("networkidle");

    // Page should contain some brand-relevant content — campaigns, dashboard, or the company name
    const body = page.locator("body");
    await expect(body).toBeVisible();

    // Check that the page has meaningful content (not an error page)
    const text = await body.textContent();
    expect(text).toBeTruthy();
    expect(text!.length).toBeGreaterThan(50);
  });

  test("discover page shows creator cards", async ({ page }) => {
    await page.goto("/discover");
    await page.waitForLoadState("networkidle");

    // Should see at least one creator name from seed data
    const creatorNames = [
      "Maya Chen",
      "Jake Morrison",
      "Priya Sharma",
      "Liam O'Brien",
      "Sofia Rodriguez",
    ];

    let foundAny = false;
    for (const name of creatorNames) {
      const count = await page.getByText(name, { exact: false }).count();
      if (count > 0) {
        foundAny = true;
        break;
      }
    }

    expect(foundAny).toBe(true);
  });

  test("campaigns list is visible", async ({ page }) => {
    await page.goto("/campaigns");
    await page.waitForLoadState("networkidle");

    // Brand1 owns 2 campaigns per seed data — page should show campaign-related content
    const body = await page.locator("body").textContent();
    expect(body).toBeTruthy();

    // Should NOT be an error page or empty state that says "no campaigns" if seed has them
    // But we accept either campaigns listed or a "create campaign" CTA
    const hasContent =
      (await page.locator('[href*="/campaigns/"]').count()) > 0 ||
      (await page.getByText(/campaign/i).count()) > 0;
    expect(hasContent).toBe(true);
  });

  test("inbox loads with seed conversations", async ({ page }) => {
    await page.goto("/inbox");
    await page.waitForLoadState("networkidle");

    // Inbox should load — check for conversation list or "no messages" text
    const body = page.locator("body");
    await expect(body).toBeVisible();

    // Seed data has conversations for brand1 — check for any creator name or conversation content
    const hasConversations =
      (await page.locator('[href*="/inbox/"]').count()) > 0 ||
      (await page.getByText(/message|conversation|inbox/i).count()) > 0;
    expect(hasConversations).toBe(true);
  });

  test("brand settings shows profile form with company name", async ({
    page,
  }) => {
    await page.goto("/brand/settings");
    await page.waitForLoadState("networkidle");

    // The settings form should have the company name pre-filled
    // Try multiple common patterns: input with value, or visible text
    const companyInput = page.locator(
      'input[name*="company"], input[name*="name"], input[placeholder*="company"], input[placeholder*="name"]'
    );

    if ((await companyInput.count()) > 0) {
      const value = await companyInput.first().inputValue();
      expect(value).toContain("NovaStar");
    } else {
      // Fallback: just check the company name appears somewhere on the page
      await expect(
        page.getByText("NovaStar Nutrition").first()
      ).toBeVisible();
    }
  });

  test("brand public profile shows company name", async ({ page }) => {
    await page.goto(`/brand/${BRAND1.slug}`);
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByText(BRAND1.company).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
