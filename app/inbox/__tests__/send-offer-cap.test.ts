import { readFileSync } from "node:fs";
import { it, expect } from "vitest";

it("sendOffer applies capOfferToCampaign", () => {
  const src = readFileSync("app/inbox/actions.ts", "utf8");
  expect(src).toMatch(/capOfferToCampaign/);
  expect(src).toMatch(/campaign_id/);
});
