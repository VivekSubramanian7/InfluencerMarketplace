import { readFileSync } from "node:fs";
import { it, expect } from "vitest";

it("applyToCampaign does not block on budget", () => {
  const src = readFileSync("app/campaigns/[id]/actions.ts", "utf8");
  expect(/budget_max[\s\S]{0,80}redirect/.test(src)).toBe(false);
});
