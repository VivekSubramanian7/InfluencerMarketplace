// e2e/auth.setup.ts
import { test as setup } from "@playwright/test";
import { login } from "./helpers/auth";
import { BRAND1, CREATOR1, PASSWORD } from "./helpers/seed-ids";

const brandAuthFile = "e2e/.auth/brand.json";
const creatorAuthFile = "e2e/.auth/creator.json";

setup("authenticate as brand", async ({ page }) => {
  await login(page, BRAND1.email, PASSWORD);
  await page.waitForURL("/brand**");
  await page.context().storageState({ path: brandAuthFile });
});

setup("authenticate as creator", async ({ page }) => {
  await login(page, CREATOR1.email, PASSWORD);
  await page.waitForURL("/dashboard**");
  await page.context().storageState({ path: creatorAuthFile });
});
