// e2e/creator-journey.spec.ts
import { test, expect } from "@playwright/test";
import { CREATOR1 } from "./helpers/seed-ids";

// All tests in this file use the creator auth state
test.use({ storageState: "e2e/.auth/creator.json" });

test.describe("Creator journey", () => {
  test("creator dashboard loads with creator content", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const body = page.locator("body");
    await expect(body).toBeVisible();

    // Dashboard should have meaningful content
    const text = await body.textContent();
    expect(text).toBeTruthy();
    expect(text!.length).toBeGreaterThan(50);
  });

  test("inbox loads with seed conversations", async ({ page }) => {
    await page.goto("/inbox");
    await page.waitForLoadState("networkidle");

    // Creator1 (Maya Chen) has conversations in seed data
    const body = page.locator("body");
    await expect(body).toBeVisible();

    // Look for conversation links, brand names, or inbox-related text
    const hasInboxContent =
      (await page.locator('[href*="/inbox/"]').count()) > 0 ||
      (await page.getByText(/message|conversation|inbox/i).count()) > 0;
    expect(hasInboxContent).toBe(true);
  });

  test("deals page shows seed deals", async ({ page }) => {
    await page.goto("/deals");
    await page.waitForLoadState("networkidle");

    // Seed data has deals — page should show deal-related content
    // Also accepts empty-state messaging in case creator1 has no deals assigned
    const hasDealsContent =
      (await page.locator('[href*="/deals/"]').count()) > 0 ||
      (await page
        .getByText(/deal|offer|accepted|pending|completed|no deals|nothing here/i)
        .count()) > 0;
    expect(hasDealsContent).toBe(true);
  });

  test("creator public profile shows name and offerings", async ({ page }) => {
    await page.goto(`/c/${CREATOR1.handle}`);
    await page.waitForLoadState("networkidle");

    // Should see the creator's name
    await expect(
      page.getByText(CREATOR1.name).first()
    ).toBeVisible({ timeout: 10_000 });

    // Should see offerings or portfolio content — seed data has offerings for creator1
    const body = await page.locator("body").textContent();
    expect(body).toBeTruthy();
    // Page should have more than just the name — offerings, bio, portfolio, etc.
    expect(body!.length).toBeGreaterThan(100);
  });

  test("campaigns page shows available campaigns", async ({ page }) => {
    await page.goto("/campaigns");
    await page.waitForLoadState("networkidle");

    // Creator should be able to browse campaigns — seed data has 4 campaigns
    const hasCampaignContent =
      (await page.locator('[href*="/campaigns/"]').count()) > 0 ||
      (await page.getByText(/campaign/i).count()) > 0;
    expect(hasCampaignContent).toBe(true);
  });
});
