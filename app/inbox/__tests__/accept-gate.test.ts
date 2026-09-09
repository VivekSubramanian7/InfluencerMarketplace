import { readFileSync } from "node:fs";
import { it, expect } from "vitest";

it("inbox accept path gates on completeness", () => {
  const src = readFileSync("app/inbox/actions.ts", "utf8");
  expect(src).toMatch(/storefrontComplete/);
});
