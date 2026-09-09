import { readFileSync } from "node:fs";
import { it, expect } from "vitest";

it("deal actions allow barter transitions", () => {
  const src = readFileSync("app/deals/[id]/actions.ts", "utf8");
  expect(src).toMatch(/mark_product_sent/);
  expect(src).toMatch(/mark_product_received/);
});
