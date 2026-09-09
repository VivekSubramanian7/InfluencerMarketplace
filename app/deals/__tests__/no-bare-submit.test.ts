import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

describe("deal detail submit buttons", () => {
  it("deal detail uses SubmitButton for actions", () => {
    const src = readFileSync("app/deals/[id]/page.tsx", "utf8");
    expect(src).toMatch(/SubmitButton/);
  });
});
