import { describe, it, expect } from "vitest";
import { creatorHasRequiredChannel } from "../channel-match";

describe("creatorHasRequiredChannel", () => {
  it("passes when no platform requirement", () => {
    expect(creatorHasRequiredChannel(["instagram"], [])).toBe(true);
  });

  it("passes on overlap", () => {
    expect(creatorHasRequiredChannel(["youtube", "instagram"], ["instagram"])).toBe(true);
  });

  it("fails with no overlap", () => {
    expect(creatorHasRequiredChannel(["tiktok"], ["instagram"])).toBe(false);
  });
});
