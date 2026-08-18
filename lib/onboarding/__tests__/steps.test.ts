import { describe, it, expect } from "vitest";
import { nextIncompleteStep, stepIndex, isWizardStep, OnboardingState } from "@/lib/onboarding/steps";

const base: OnboardingState = {
  hasProfile: false,
  isLive: false,
  socialCount: 0,
  offeringCount: 0,
  portfolioCount: 0,
};

describe("nextIncompleteStep", () => {
  it("walks the steps in order as data appears", () => {
    expect(nextIncompleteStep(base)).toBe("profile");
    expect(nextIncompleteStep({ ...base, hasProfile: true })).toBe("socials");
    expect(nextIncompleteStep({ ...base, hasProfile: true, socialCount: 1 })).toBe("offerings");
    expect(
      nextIncompleteStep({ ...base, hasProfile: true, socialCount: 1, offeringCount: 2 })
    ).toBe("highlights");
    expect(
      nextIncompleteStep({
        ...base, hasProfile: true, socialCount: 1, offeringCount: 2, portfolioCount: 3,
      })
    ).toBe("publish");
  });

  it("is done once live with everything present", () => {
    expect(
      nextIncompleteStep({
        hasProfile: true, isLive: true, socialCount: 1, offeringCount: 1, portfolioCount: 1,
      })
    ).toBe("done");
  });

  it("skipped-over gaps come first on return visits", () => {
    // creator skipped socials, added an offering from the dashboard
    expect(
      nextIncompleteStep({ ...base, hasProfile: true, offeringCount: 1 })
    ).toBe("socials");
  });
});

describe("stepIndex / isWizardStep", () => {
  it("indexes steps for the progress dots", () => {
    expect(stepIndex("profile")).toBe(0);
    expect(stepIndex("publish")).toBe(4);
  });

  it("guards arbitrary strings", () => {
    expect(isWizardStep("socials")).toBe(true);
    expect(isWizardStep("hack")).toBe(false);
  });
});
