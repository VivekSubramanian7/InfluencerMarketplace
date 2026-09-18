// e2e/campaign-flow.spec.ts
import { test, expect, Browser, BrowserContext, Page } from "@playwright/test";
import { BRAND1, CREATOR1, PASSWORD } from "./helpers/seed-ids";
import { login } from "./helpers/auth";

/*
 * Cross-role campaign lifecycle tests.
 * Each test that needs both brand + creator creates two independent
 * browser contexts so cookies/storage never mix.
 */

/** Helper: create a second browser context and log in as the given user. */
async function contextFor(
  browser: Browser,
  email: string,
  password: string
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, email, password);
  return { context, page };
}

test.describe("Campaign Flow — cross-role", () => {
  // Brand context uses saved auth state
  test.use({ storageState: "e2e/.auth/brand.json" });

  test.describe.serial(
    "Brand creates campaign → creator applies → brand accepts",
    () => {
      const campaignTitle = `E2E Campaign ${Date.now()}`;
      let campaignUrl: string;

      test("brand creates a campaign", async ({ page }) => {
        await page.goto("/campaigns");
        await page.waitForLoadState("networkidle");

        // Click the primary CTA to create a new campaign
        const newBtn = page.getByRole("link", { name: /new campaign/i }).or(
          page.getByRole("button", { name: /new campaign/i })
        );
        await newBtn.first().click();
        await page.waitForLoadState("networkidle");

        // Fill the campaign form
        await page.getByLabel(/title/i).fill(campaignTitle);

        const descField = page
          .getByLabel(/description/i)
          .or(page.getByPlaceholder(/description/i));
        await descField.first().fill("Testing campaign flow end-to-end");

        // Pick offering type — select first available option
        const offeringSelect = page
          .getByLabel(/offering type/i)
          .or(page.getByLabel(/type/i));
        if ((await offeringSelect.count()) > 0) {
          const sel = offeringSelect.first();
          const tag = await sel.evaluate((el) =>
            (el as HTMLElement).tagName.toLowerCase()
          );
          if (tag === "select") {
            const options = await sel.locator("option").allTextContents();
            const firstNonEmpty = options.find((o) => o.trim() !== "");
            if (firstNonEmpty) await sel.selectOption({ label: firstNonEmpty });
          } else {
            await sel.click();
            await page
              .getByRole("option")
              .first()
              .click()
              .catch(() => {});
          }
        }

        // Budget fields
        const budgetMin = page
          .getByLabel(/min/i)
          .or(page.getByPlaceholder(/min/i));
        if ((await budgetMin.count()) > 0)
          await budgetMin.first().fill("100");

        const budgetMax = page
          .getByLabel(/max/i)
          .or(page.getByPlaceholder(/max/i));
        if ((await budgetMax.count()) > 0)
          await budgetMax.first().fill("500");

        // Submit
        const submitBtn = page
          .getByRole("button", { name: /create|save|publish|submit/i })
          .first();
        await submitBtn.click();

        // Wait for navigation to campaign detail or list
        await page.waitForLoadState("networkidle");

        // Should see campaign title on the resulting page
        await expect(page.getByText(campaignTitle).first()).toBeVisible({
          timeout: 10_000,
        });
        campaignUrl = page.url();
      });

      test("creator applies to the campaign", async ({ browser }) => {
        const { context, page } = await contextFor(
          browser,
          CREATOR1.email,
          PASSWORD
        );

        try {
          await page.goto("/campaigns");
          await page.waitForLoadState("networkidle");

          // Find and click into our campaign
          const campaignLink = page.getByRole("link", {
            name: new RegExp(campaignTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
          });

          // Campaign might also appear as a card — click it
          if ((await campaignLink.count()) > 0) {
            await campaignLink.first().click();
          } else {
            // Fallback: search or scroll to find the campaign text, then click
            const campaignText = page.getByText(campaignTitle).first();
            await campaignText.click();
          }
          await page.waitForLoadState("networkidle");

          // Fill application form
          const pitchField = page
            .getByLabel(/pitch|message|why/i)
            .or(page.getByPlaceholder(/pitch|message|why/i));
          await pitchField.first().fill("I'd love to work on this!");

          const priceField = page
            .getByLabel(/price|rate|amount/i)
            .or(page.getByPlaceholder(/price|rate|amount/i));
          if ((await priceField.count()) > 0) {
            await priceField.first().fill("250");
          }

          // Submit application
          const applyBtn = page
            .getByRole("button", { name: /apply|submit|send/i })
            .first();
          await applyBtn.click();
          await page.waitForLoadState("networkidle");

          // Should see success indicator
          const successIndicator = page
            .getByText(/applied|submitted|success|pending/i)
            .first();
          await expect(successIndicator).toBeVisible({ timeout: 10_000 });
        } finally {
          await context.close();
        }
      });

      test("brand accepts application → deal created", async ({ page }) => {
        // Navigate to the campaign we created
        if (campaignUrl) {
          await page.goto(campaignUrl);
        } else {
          await page.goto("/campaigns");
          await page.getByText(campaignTitle).first().click();
        }
        await page.waitForLoadState("networkidle");

        // Look for the applications tab or section
        const applicationsTab = page.getByRole("link", {
          name: /application/i,
        }).or(page.getByRole("tab", { name: /application/i }));
        if ((await applicationsTab.count()) > 0) {
          await applicationsTab.first().click();
          await page.waitForLoadState("networkidle");
        }

        // Find the creator's application and accept it
        const acceptBtn = page
          .getByRole("button", { name: /accept|approve/i })
          .first();
        await acceptBtn.click();
        await page.waitForLoadState("networkidle");

        // Should land on deal page or see deal confirmation
        const dealIndicator = page
          .getByText(/deal|accepted|created/i)
          .first();
        await expect(dealIndicator).toBeVisible({ timeout: 10_000 });
      });
    }
  );

  test("brand declines application with reason", async ({
    page,
    browser,
  }) => {
    const campaignTitle = `E2E Decline ${Date.now()}`;

    // Step 1: Brand creates a campaign
    await page.goto("/campaigns");
    await page.waitForLoadState("networkidle");
    const newBtn = page
      .getByRole("link", { name: /new campaign/i })
      .or(page.getByRole("button", { name: /new campaign/i }));
    await newBtn.first().click();
    await page.waitForLoadState("networkidle");

    await page.getByLabel(/title/i).fill(campaignTitle);
    const descField = page
      .getByLabel(/description/i)
      .or(page.getByPlaceholder(/description/i));
    await descField.first().fill("Decline test campaign");

    const offeringSelect = page
      .getByLabel(/offering type/i)
      .or(page.getByLabel(/type/i));
    if ((await offeringSelect.count()) > 0) {
      const sel = offeringSelect.first();
      const tag = await sel.evaluate((el) => (el as HTMLElement).tagName.toLowerCase());
      if (tag === "select") {
        const options = await sel.locator("option").allTextContents();
        const firstNonEmpty = options.find((o) => o.trim() !== "");
        if (firstNonEmpty) await sel.selectOption({ label: firstNonEmpty });
      }
    }

    const budgetMin = page.getByLabel(/min/i).or(page.getByPlaceholder(/min/i));
    if ((await budgetMin.count()) > 0) await budgetMin.first().fill("100");
    const budgetMax = page.getByLabel(/max/i).or(page.getByPlaceholder(/max/i));
    if ((await budgetMax.count()) > 0) await budgetMax.first().fill("500");

    await page
      .getByRole("button", { name: /create|save|publish|submit/i })
      .first()
      .click();
    await page.waitForLoadState("networkidle");
    const createdCampaignUrl = page.url();

    // Step 2: Creator applies
    const { context: creatorCtx, page: creatorPage } = await contextFor(
      browser,
      CREATOR1.email,
      PASSWORD
    );
    try {
      await creatorPage.goto("/campaigns");
      await creatorPage.waitForLoadState("networkidle");
      const link = creatorPage.getByText(campaignTitle).first();
      await link.click();
      await creatorPage.waitForLoadState("networkidle");

      const pitchField = creatorPage
        .getByLabel(/pitch|message|why/i)
        .or(creatorPage.getByPlaceholder(/pitch|message|why/i));
      await pitchField.first().fill("Please consider me");

      const priceField = creatorPage
        .getByLabel(/price|rate|amount/i)
        .or(creatorPage.getByPlaceholder(/price|rate|amount/i));
      if ((await priceField.count()) > 0) await priceField.first().fill("200");

      await creatorPage
        .getByRole("button", { name: /apply|submit|send/i })
        .first()
        .click();
      await creatorPage.waitForLoadState("networkidle");
    } finally {
      await creatorCtx.close();
    }

    // Step 3: Brand declines with reason
    await page.goto(createdCampaignUrl);
    await page.waitForLoadState("networkidle");

    const applicationsTab = page
      .getByRole("link", { name: /application/i })
      .or(page.getByRole("tab", { name: /application/i }));
    if ((await applicationsTab.count()) > 0) {
      await applicationsTab.first().click();
      await page.waitForLoadState("networkidle");
    }

    const declineBtn = page
      .getByRole("button", { name: /decline|reject/i })
      .first();
    await declineBtn.click();

    // Fill reason in dialog/form
    const reasonField = page
      .getByLabel(/reason/i)
      .or(page.getByPlaceholder(/reason/i));
    if ((await reasonField.count()) > 0) {
      await reasonField.first().fill("Not the right fit");
    }

    // Confirm decline
    const confirmBtn = page
      .getByRole("button", { name: /confirm|decline|submit/i })
      .first();
    await confirmBtn.click();
    await page.waitForLoadState("networkidle");

    // Verify declined state
    await expect(
      page.getByText(/declined|rejected/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("creator withdraws own application", async ({ page, browser }) => {
    const campaignTitle = `E2E Withdraw ${Date.now()}`;

    // Brand creates a campaign
    await page.goto("/campaigns");
    await page.waitForLoadState("networkidle");
    const newBtn = page
      .getByRole("link", { name: /new campaign/i })
      .or(page.getByRole("button", { name: /new campaign/i }));
    await newBtn.first().click();
    await page.waitForLoadState("networkidle");

    await page.getByLabel(/title/i).fill(campaignTitle);
    const descField = page
      .getByLabel(/description/i)
      .or(page.getByPlaceholder(/description/i));
    await descField.first().fill("Withdraw test campaign");

    const offeringSelect = page
      .getByLabel(/offering type/i)
      .or(page.getByLabel(/type/i));
    if ((await offeringSelect.count()) > 0) {
      const sel = offeringSelect.first();
      const tag = await sel.evaluate((el) => (el as HTMLElement).tagName.toLowerCase());
      if (tag === "select") {
        const options = await sel.locator("option").allTextContents();
        const firstNonEmpty = options.find((o) => o.trim() !== "");
        if (firstNonEmpty) await sel.selectOption({ label: firstNonEmpty });
      }
    }

    const budgetMin = page.getByLabel(/min/i).or(page.getByPlaceholder(/min/i));
    if ((await budgetMin.count()) > 0) await budgetMin.first().fill("100");
    const budgetMax = page.getByLabel(/max/i).or(page.getByPlaceholder(/max/i));
    if ((await budgetMax.count()) > 0) await budgetMax.first().fill("500");

    await page
      .getByRole("button", { name: /create|save|publish|submit/i })
      .first()
      .click();
    await page.waitForLoadState("networkidle");

    // Creator applies then withdraws
    const { context: creatorCtx, page: creatorPage } = await contextFor(
      browser,
      CREATOR1.email,
      PASSWORD
    );
    try {
      await creatorPage.goto("/campaigns");
      await creatorPage.waitForLoadState("networkidle");
      await creatorPage.getByText(campaignTitle).first().click();
      await creatorPage.waitForLoadState("networkidle");

      // Apply
      const pitchField = creatorPage
        .getByLabel(/pitch|message|why/i)
        .or(creatorPage.getByPlaceholder(/pitch|message|why/i));
      await pitchField.first().fill("Applying to withdraw later");

      const priceField = creatorPage
        .getByLabel(/price|rate|amount/i)
        .or(creatorPage.getByPlaceholder(/price|rate|amount/i));
      if ((await priceField.count()) > 0) await priceField.first().fill("300");

      await creatorPage
        .getByRole("button", { name: /apply|submit|send/i })
        .first()
        .click();
      await creatorPage.waitForLoadState("networkidle");

      // Withdraw
      const withdrawBtn = creatorPage
        .getByRole("button", { name: /withdraw|cancel|remove/i })
        .first();
      await withdrawBtn.click();

      // Confirm withdrawal if dialog appears
      const confirmBtn = creatorPage.getByRole("button", {
        name: /confirm|yes|withdraw/i,
      });
      if ((await confirmBtn.count()) > 0) {
        await confirmBtn.first().click();
      }
      await creatorPage.waitForLoadState("networkidle");

      // Verify application removed — the apply button should reappear or status says withdrawn
      const applyAgain = creatorPage.getByRole("button", {
        name: /apply|submit/i,
      });
      const withdrawnText = creatorPage.getByText(/withdrawn|removed/i);
      const eitherVisible = await Promise.race([
        applyAgain
          .first()
          .waitFor({ timeout: 5_000 })
          .then(() => true)
          .catch(() => false),
        withdrawnText
          .first()
          .waitFor({ timeout: 5_000 })
          .then(() => true)
          .catch(() => false),
      ]);
      expect(eitherVisible).toBe(true);
    } finally {
      await creatorCtx.close();
    }
  });
});
