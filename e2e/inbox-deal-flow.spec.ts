// e2e/inbox-deal-flow.spec.ts
import { test, expect, Browser, BrowserContext, Page } from "@playwright/test";
import { BRAND1, CREATOR1, CREATOR2, PASSWORD } from "./helpers/seed-ids";
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

test.describe("Inbox & Deal Flow — cross-role", () => {
  test.use({ storageState: "e2e/.auth/brand.json" });

  test.describe.serial(
    "Reachout → accept invite → offer → accept offer → deal",
    () => {
      let conversationUrl: string | undefined;

      test("brand sends reachout to creator via discover", async ({
        page,
      }) => {
        await page.goto("/discover");
        await page.waitForLoadState("networkidle");

        // Find a creator to reach out to — look for a creator card or checkbox
        const creatorCard = page
          .getByText(/creator/i)
          .or(page.locator("[data-creator-id]"))
          .first();

        // Try clicking a checkbox/select on the card
        const checkbox = page.locator(
          'input[type="checkbox"], [role="checkbox"]'
        );
        if ((await checkbox.count()) > 0) {
          await checkbox.first().click();
        } else {
          await creatorCard.click();
        }

        // Click the invite/reachout button
        const inviteBtn = page
          .getByRole("button", { name: /invite|reach out|send|contact/i })
          .or(page.getByRole("link", { name: /invite|reach out|send|contact/i }));
        await inviteBtn.first().click();
        await page.waitForLoadState("networkidle");

        // May need to fill a message in a dialog
        const msgField = page
          .getByLabel(/message/i)
          .or(page.getByPlaceholder(/message/i));
        if ((await msgField.count()) > 0) {
          await msgField.first().fill("We'd love to work with you!");
        }

        // Confirm send if there's a confirm button
        const sendBtn = page.getByRole("button", {
          name: /send|confirm|submit/i,
        });
        if ((await sendBtn.count()) > 0) {
          await sendBtn.first().click();
          await page.waitForLoadState("networkidle");
        }

        // Should redirect to inbox or show success
        const inboxIndicator = page
          .getByText(/sent|inbox|success/i)
          .first();
        await expect(inboxIndicator).toBeVisible({ timeout: 10_000 });
      });

      test("creator accepts invite in inbox", async ({ browser }) => {
        const { context, page } = await contextFor(
          browser,
          CREATOR1.email,
          PASSWORD
        );
        try {
          await page.goto("/inbox");
          await page.waitForLoadState("networkidle");

          // Find conversation from brand — look for brand name or recent message
          const convoLink = page
            .getByText(/novastar|we'd love/i)
            .first();
          await convoLink.click();
          await page.waitForLoadState("networkidle");

          conversationUrl = page.url();

          // Accept the invite
          const acceptBtn = page
            .getByRole("button", { name: /accept/i })
            .first();
          await acceptBtn.click();
          await page.waitForLoadState("networkidle");

          // Verify accepted state
          await expect(
            page.getByText(/accepted|active/i).first()
          ).toBeVisible({ timeout: 10_000 });
        } finally {
          await context.close();
        }
      });

      test("brand sends offer in conversation", async ({ page }) => {
        // Navigate to inbox and find the accepted conversation
        await page.goto("/inbox");
        await page.waitForLoadState("networkidle");

        // Click into the conversation
        const convoLink = page
          .getByText(/novastar|maya|accepted/i)
          .first();
        if ((await convoLink.count()) > 0) {
          await convoLink.click();
        } else if (conversationUrl) {
          await page.goto(conversationUrl);
        }
        await page.waitForLoadState("networkidle");

        // Click "Send Offer" or "Make Offer" button
        const offerBtn = page
          .getByRole("button", { name: /offer|send offer|make offer/i })
          .first();
        await offerBtn.click();
        await page.waitForLoadState("networkidle");

        // Fill offer form
        const priceField = page
          .getByLabel(/price|amount|rate|budget/i)
          .or(page.getByPlaceholder(/price|amount|rate/i));
        if ((await priceField.count()) > 0) {
          await priceField.first().fill("300");
        }

        const goalsField = page
          .getByLabel(/goals|deliverables|description/i)
          .or(page.getByPlaceholder(/goals|deliverables/i));
        if ((await goalsField.count()) > 0) {
          await goalsField.first().fill("One Instagram reel featuring our product");
        }

        // Pick an offering if selector exists
        const offeringSelect = page
          .getByLabel(/offering/i)
          .or(page.locator("select").first());
        if ((await offeringSelect.count()) > 0) {
          const sel = offeringSelect.first();
          const tag = await sel.evaluate((el) => (el as HTMLElement).tagName.toLowerCase());
          if (tag === "select") {
            const options = await sel.locator("option").allTextContents();
            const firstNonEmpty = options.find((o) => o.trim() !== "");
            if (firstNonEmpty)
              await sel.selectOption({ label: firstNonEmpty });
          }
        }

        // Submit offer
        const submitBtn = page
          .getByRole("button", { name: /send|submit|confirm/i })
          .first();
        await submitBtn.click();
        await page.waitForLoadState("networkidle");

        // Verify offer sent
        await expect(
          page.getByText(/offer sent|pending|waiting/i).first()
        ).toBeVisible({ timeout: 10_000 });
      });

      test("creator accepts offer → deal created", async ({ browser }) => {
        const { context, page } = await contextFor(
          browser,
          CREATOR1.email,
          PASSWORD
        );
        try {
          await page.goto("/inbox");
          await page.waitForLoadState("networkidle");

          // Navigate to the conversation with the offer
          const convoLink = page
            .getByText(/novastar|offer/i)
            .first();
          await convoLink.click();
          await page.waitForLoadState("networkidle");

          // Accept the offer
          const acceptBtn = page
            .getByRole("button", { name: /accept/i })
            .first();
          await acceptBtn.click();
          await page.waitForLoadState("networkidle");

          // Should redirect to deal page or show deal created
          await expect(
            page.getByText(/deal|accepted|created/i).first()
          ).toBeVisible({ timeout: 10_000 });
        } finally {
          await context.close();
        }
      });
    }
  );

  test("messages work in both directions using seed conversation", async ({
    page,
    browser,
  }) => {
    // Brand sends a message in an existing conversation
    await page.goto("/inbox");
    await page.waitForLoadState("networkidle");

    // Click into the first conversation
    const firstConvo = page
      .locator("a[href*='/inbox/']")
      .or(page.locator("[data-conversation-id]"))
      .first();
    await firstConvo.click();
    await page.waitForLoadState("networkidle");

    const convoUrl = page.url();
    const brandMessage = `Brand E2E msg ${Date.now()}`;

    // Type and send message
    const msgInput = page
      .getByLabel(/message/i)
      .or(page.getByPlaceholder(/message|type|write/i))
      .or(page.locator("textarea").first());
    await msgInput.first().fill(brandMessage);

    const sendBtn = page
      .getByRole("button", { name: /send/i })
      .first();
    await sendBtn.click();
    await page.waitForLoadState("networkidle");

    // Verify message appears
    await expect(page.getByText(brandMessage).first()).toBeVisible({
      timeout: 10_000,
    });

    // Creator views and replies
    const { context, page: creatorPage } = await contextFor(
      browser,
      CREATOR1.email,
      PASSWORD
    );
    try {
      await creatorPage.goto(convoUrl);
      await creatorPage.waitForLoadState("networkidle");

      // Verify brand's message is visible
      await expect(
        creatorPage.getByText(brandMessage).first()
      ).toBeVisible({ timeout: 10_000 });

      const creatorReply = `Creator E2E reply ${Date.now()}`;
      const replyInput = creatorPage
        .getByLabel(/message/i)
        .or(creatorPage.getByPlaceholder(/message|type|write/i))
        .or(creatorPage.locator("textarea").first());
      await replyInput.first().fill(creatorReply);

      const replySendBtn = creatorPage
        .getByRole("button", { name: /send/i })
        .first();
      await replySendBtn.click();
      await creatorPage.waitForLoadState("networkidle");

      await expect(
        creatorPage.getByText(creatorReply).first()
      ).toBeVisible({ timeout: 10_000 });
    } finally {
      await context.close();
    }
  });

  test("creator declines offer → stays in conversation", async ({
    page,
    browser,
  }) => {
    // Brand navigates to an accepted conversation and sends an offer
    await page.goto("/inbox");
    await page.waitForLoadState("networkidle");

    // Find an accepted/active conversation
    const activeConvo = page
      .locator("a[href*='/inbox/']")
      .or(page.locator("[data-conversation-id]"))
      .first();
    await activeConvo.click();
    await page.waitForLoadState("networkidle");

    const convoUrl = page.url();

    // Send an offer if possible
    const offerBtn = page.getByRole("button", {
      name: /offer|send offer|make offer/i,
    });
    if ((await offerBtn.count()) > 0) {
      await offerBtn.first().click();
      await page.waitForLoadState("networkidle");

      const priceField = page
        .getByLabel(/price|amount|rate/i)
        .or(page.getByPlaceholder(/price|amount|rate/i));
      if ((await priceField.count()) > 0) await priceField.first().fill("150");

      const goalsField = page
        .getByLabel(/goals|deliverables|description/i)
        .or(page.getByPlaceholder(/goals|deliverables/i));
      if ((await goalsField.count()) > 0)
        await goalsField.first().fill("Test offer to decline");

      await page
        .getByRole("button", { name: /send|submit|confirm/i })
        .first()
        .click();
      await page.waitForLoadState("networkidle");
    }

    // Creator declines
    const { context, page: creatorPage } = await contextFor(
      browser,
      CREATOR1.email,
      PASSWORD
    );
    try {
      await creatorPage.goto(convoUrl);
      await creatorPage.waitForLoadState("networkidle");

      const declineBtn = creatorPage.getByRole("button", {
        name: /decline|reject/i,
      });
      if ((await declineBtn.count()) > 0) {
        await declineBtn.first().click();
        await creatorPage.waitForLoadState("networkidle");

        // Confirm decline if dialog
        const confirmBtn = creatorPage.getByRole("button", {
          name: /confirm|decline|yes/i,
        });
        if ((await confirmBtn.count()) > 0) {
          await confirmBtn.first().click();
          await creatorPage.waitForLoadState("networkidle");
        }
      }

      // Should still be in conversation, NOT on deals page
      expect(creatorPage.url()).toContain("/inbox");

      // Conversation should still be visible
      const msgInput = creatorPage
        .getByLabel(/message/i)
        .or(creatorPage.getByPlaceholder(/message|type|write/i))
        .or(creatorPage.locator("textarea").first());
      await expect(msgInput.first()).toBeVisible({ timeout: 5_000 });
    } finally {
      await context.close();
    }
  });
});
