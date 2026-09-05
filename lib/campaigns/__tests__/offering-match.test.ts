import { describe, it, expect } from "vitest";
import { creatorCanApply } from "@/lib/campaigns/offering-match";

describe("creatorCanApply", () => {
  it("allows a matching active offering", () => {
    expect(creatorCanApply({
      campaignType: "short_form_post",
      activeOfferingTypes: ["short_form_post", "ugc_video"],
    })).toBe(true);
  });
  it("blocks a missing format", () => {
    expect(creatorCanApply({
      campaignType: "short_form_post",
      activeOfferingTypes: ["dedicated_video"],
    })).toBe(false);
  });
});
