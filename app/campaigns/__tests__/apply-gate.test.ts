import { readFileSync } from "node:fs";
import { it, expect } from "vitest";

it("applyToCampaign gates on storefront completeness", () => {
  const src = readFileSync("app/campaigns/[id]/actions.ts", "utf8");
  expect(src).toMatch(/storefrontComplete/);
});
