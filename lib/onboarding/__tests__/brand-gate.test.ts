import { describe, it, expect } from "vitest";
import { shouldForceBrandOnboarding } from "@/lib/onboarding/brand-gate";

describe("shouldForceBrandOnboarding", () => {
  it("first login with no profile still opens the wizard", () => {
    expect(shouldForceBrandOnboarding(false, "login")).toBe(true);
  });
  it("nav to Home never hijacks, even with no profile", () => {
    expect(shouldForceBrandOnboarding(false, "nav")).toBe(false);
    expect(shouldForceBrandOnboarding(true, "nav")).toBe(false);
  });
});
