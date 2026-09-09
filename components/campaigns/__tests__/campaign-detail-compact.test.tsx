import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const src = readFileSync("components/campaigns/campaign-detail.tsx", "utf8");

describe("campaign detail compact register", () => {
  it("has no font-extrabold (DESIGN.md App register)", () => {
    expect(src.includes("font-extrabold")).toBe(false);
  });
  it("renders a compact dismiss control", () => {
    expect(src).toMatch(/href=\{returnTo.*\}[\s\S]*?Close|Close campaign/);
  });
});
