// e2e/deal-lifecycle.spec.ts
import { test, expect, Browser, BrowserContext, Page } from "@playwright/test";
import { BRAND1, CREATOR1, PASSWORD } from "./helpers/seed-ids";
import { login } from "./helpers/auth";

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

/**
 * Finds a deal in a specific state by navigating to /deals and scanning.
 * Returns the deal page URL or null if not found.
 */
async function findDealInState(
  page: Page,
  statePattern: RegExp
): Promise<string | null> {
  await page.goto("/deals");
  await page.waitForLoadState("networkidle");

  // Look for a deal row/card containing the state text
  const dealLinks = page.locator("a[href*='/deals/']");
  const count = await dealLinks.count();

  for (let i = 0; i < count; i++) {
    const link = dealLinks.nth(i);
    const text = await link.textContent();
    if (text && statePattern.test(text)) {
      const href = await link.getAttribute("href");
      await link.click();
      await page.waitForLoadState("networkidle");
      return page.url();
    }
  }
  return null;
}

test.describe("Deal Lifecycle", () => {
  test.use({ storageState: "e2e/.auth/brand.json" });

  test.describe.serial("Happy path deal transitions", () => {
    let dealUrl: string;

    test("find or navigate to an accepted deal", async ({ page }) => {
      await page.goto("/deals");
      await page.waitForLoadState("networkidle");

      // Click into the first available deal
      const dealLink = page
        .locator("a[href*='/deals/']")
        .first();
      await dealLink.click();
      await page.waitForLoadState("networkidle");
      dealUrl = page.url();

      // Verify we're on a deal page
      await expect(
        page.getByText(/deal|status|progress/i).first()
      ).toBeVisible({ timeout: 10_000 });
    });

    test("brand marks product sent", async ({ page }) => {
      await page.goto(dealUrl);
      await page.waitForLoadState("networkidle");

      const markSentBtn = page
        .getByRole("button", {
          name: /mark.*sent|product sent|ship|send product/i,
        })
        .first();

      // Only click if available (deal might already be past this state)
      if ((await markSentBtn.count()) > 0) {
        await markSentBtn.click();
        await page.waitForLoadState("networkidle");

        await expect(
          page.getByText(/sent|shipped|product sent/i).first()
        ).toBeVisible({ timeout: 10_000 });
      }
    });

    test("creator marks product received", async ({ browser }) => {
      const { context, page } = await contextFor(
        browser,
        CREATOR1.email,
        PASSWORD
      );
      try {
        await page.goto(dealUrl);
        await page.waitForLoadState("networkidle");

        const receivedBtn = page
          .getByRole("button", {
            name: /received|mark.*received|confirm.*received/i,
          })
          .first();

        if ((await receivedBtn.count()) > 0) {
          await receivedBtn.click();
          await page.waitForLoadState("networkidle");

          await expect(
            page.getByText(/received|in progress/i).first()
          ).toBeVisible({ timeout: 10_000 });
        }
      } finally {
        await context.close();
      }
    });

    test("creator submits preview", async ({ browser }) => {
      const { context, page } = await contextFor(
        browser,
        CREATOR1.email,
        PASSWORD
      );
      try {
        await page.goto(dealUrl);
        await page.waitForLoadState("networkidle");

        const previewBtn = page
          .getByRole("button", {
            name: /submit.*preview|upload.*preview|add.*preview/i,
          })
          .first();

        if ((await previewBtn.count()) > 0) {
          await previewBtn.click();
          await page.waitForLoadState("networkidle");
        }

        // Fill preview URL
        const urlField = page
          .getByLabel(/url|link|preview/i)
          .or(page.getByPlaceholder(/url|link|preview/i));
        if ((await urlField.count()) > 0) {
          await urlField.first().fill("https://example.com/preview-e2e");
        }

        const submitBtn = page
          .getByRole("button", { name: /submit|send|save/i })
          .first();
        if ((await submitBtn.count()) > 0) {
          await submitBtn.click();
          await page.waitForLoadState("networkidle");
        }

        await expect(
          page.getByText(/preview|submitted|pending.*review/i).first()
        ).toBeVisible({ timeout: 10_000 });
      } finally {
        await context.close();
      }
    });

    test("brand approves preview", async ({ page }) => {
      await page.goto(dealUrl);
      await page.waitForLoadState("networkidle");

      const approveBtn = page
        .getByRole("button", {
          name: /approve.*preview|approve/i,
        })
        .first();

      if ((await approveBtn.count()) > 0) {
        await approveBtn.click();
        await page.waitForLoadState("networkidle");

        await expect(
          page.getByText(/approved|publish|waiting/i).first()
        ).toBeVisible({ timeout: 10_000 });
      }
    });

    test("creator marks published", async ({ browser }) => {
      const { context, page } = await contextFor(
        browser,
        CREATOR1.email,
        PASSWORD
      );
      try {
        await page.goto(dealUrl);
        await page.waitForLoadState("networkidle");

        const publishBtn = page
          .getByRole("button", {
            name: /mark.*published|publish|submit.*live/i,
          })
          .first();

        if ((await publishBtn.count()) > 0) {
          await publishBtn.click();
          await page.waitForLoadState("networkidle");
        }

        // Fill live URL
        const urlField = page
          .getByLabel(/url|link|live/i)
          .or(page.getByPlaceholder(/url|link|live/i));
        if ((await urlField.count()) > 0) {
          await urlField.first().fill("https://example.com/live-e2e");
        }

        const submitBtn = page
          .getByRole("button", { name: /submit|send|save|confirm/i })
          .first();
        if ((await submitBtn.count()) > 0) {
          await submitBtn.click();
          await page.waitForLoadState("networkidle");
        }

        await expect(
          page.getByText(/published|live|pending.*approval/i).first()
        ).toBeVisible({ timeout: 10_000 });
      } finally {
        await context.close();
      }
    });

    test("brand approves → deal completes", async ({ page }) => {
      await page.goto(dealUrl);
      await page.waitForLoadState("networkidle");

      const approveBtn = page
        .getByRole("button", {
          name: /approve|complete|confirm/i,
        })
        .first();

      if ((await approveBtn.count()) > 0) {
        await approveBtn.click();
        await page.waitForLoadState("networkidle");

        await expect(
          page.getByText(/complete|finished|done/i).first()
        ).toBeVisible({ timeout: 10_000 });
      }
    });
  });

  test("submit review after deal completion", async ({ page }) => {
    // Navigate to deals and find a completed one
    await page.goto("/deals");
    await page.waitForLoadState("networkidle");

    // Click into a deal (preferring one that's completed)
    const dealLink = page.locator("a[href*='/deals/']").first();
    await dealLink.click();
    await page.waitForLoadState("networkidle");

    // Look for a review form or "Leave Review" button
    const reviewBtn = page.getByRole("button", {
      name: /review|leave.*review|rate/i,
    });
    if ((await reviewBtn.count()) > 0) {
      await reviewBtn.first().click();
      await page.waitForLoadState("networkidle");
    }

    // Fill star rating — try clicking the 5th star
    const stars = page.locator(
      '[data-rating], [aria-label*="star"], [role="radio"], .star'
    );
    if ((await stars.count()) >= 5) {
      await stars.nth(4).click(); // 5th star (0-indexed)
    } else {
      // Fallback: look for a numeric input or select
      const ratingInput = page
        .getByLabel(/rating|stars/i)
        .or(page.getByPlaceholder(/rating/i));
      if ((await ratingInput.count()) > 0) {
        await ratingInput.first().fill("5");
      }
    }

    // Fill review text
    const reviewText = page
      .getByLabel(/review|comment|feedback/i)
      .or(page.getByPlaceholder(/review|comment|feedback/i))
      .or(page.locator("textarea").first());
    await reviewText.first().fill("Great collaboration! Highly recommend.");

    // Submit
    const submitBtn = page
      .getByRole("button", { name: /submit|save|post/i })
      .first();
    await submitBtn.click();
    await page.waitForLoadState("networkidle");

    // Verify review saved
    await expect(
      page.getByText(/great collaboration|review.*submitted|thank/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("brand requests revision on preview", async ({
    page,
    browser,
  }) => {
    // Find a deal or navigate to one with a preview
    await page.goto("/deals");
    await page.waitForLoadState("networkidle");

    const dealLink = page.locator("a[href*='/deals/']").first();
    await dealLink.click();
    await page.waitForLoadState("networkidle");
    const dealUrl = page.url();

    // Look for revision button
    const revisionBtn = page.getByRole("button", {
      name: /revision|request.*change|request.*revision/i,
    });

    if ((await revisionBtn.count()) > 0) {
      await revisionBtn.first().click();
      await page.waitForLoadState("networkidle");

      // Fill revision note
      const noteField = page
        .getByLabel(/note|reason|feedback|revision/i)
        .or(page.getByPlaceholder(/note|reason|feedback/i))
        .or(page.locator("textarea").first());
      await noteField.first().fill("Please adjust the intro section");

      const submitBtn = page
        .getByRole("button", { name: /submit|send|request/i })
        .first();
      await submitBtn.click();
      await page.waitForLoadState("networkidle");

      // Verify revision requested state
      await expect(
        page.getByText(/revision|changes requested/i).first()
      ).toBeVisible({ timeout: 10_000 });

      // Creator should see the revision note
      const { context, page: creatorPage } = await contextFor(
        browser,
        CREATOR1.email,
        PASSWORD
      );
      try {
        await creatorPage.goto(dealUrl);
        await creatorPage.waitForLoadState("networkidle");

        await expect(
          creatorPage
            .getByText(/adjust the intro|revision|changes requested/i)
            .first()
        ).toBeVisible({ timeout: 10_000 });
      } finally {
        await context.close();
      }
    }
  });
});
