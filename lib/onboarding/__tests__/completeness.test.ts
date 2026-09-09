import { describe, it, expect } from "vitest";
import { storefrontComplete, missingStorefrontItems } from "../completeness";

const full = { socialCount: 1, offeringCount: 1, portfolioCount: 1, isLive: true };

describe("storefrontComplete", () => {
  it("true when all present and live", () => {
    expect(storefrontComplete(full)).toBe(true);
  });

  it("false when a channel is missing", () => {
    expect(storefrontComplete({ ...full, socialCount: 0 })).toBe(false);
  });

  it("lists missing items", () => {
    expect(missingStorefrontItems({ ...full, offeringCount: 0, portfolioCount: 0 }))
      .toEqual(["an offering", "a sample link"]);
  });
});
