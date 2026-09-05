import { describe, it, expect } from "vitest";
import { publishDecision } from "@/lib/creators/waitlist";

describe("publishDecision", () => {
  it("waitlists missing and sub-threshold counts", () => {
    expect(publishDecision(null)).toBe("waitlisted");
    expect(publishDecision(2999)).toBe("waitlisted");
  });
  it("publishes at the floor", () => {
    expect(publishDecision(3000)).toBe("live");
  });
});
