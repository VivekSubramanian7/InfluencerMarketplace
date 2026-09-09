import { describe, it, expect } from "vitest";
import { budgetWarning, capOfferToCampaign } from "../budget";

describe("budgetWarning", () => {
  it("warns when price exceeds budget max", () => {
    expect(budgetWarning(60000, 50000)).toMatch(/above the brand'?s budget/i);
  });
  it("is silent within budget", () => {
    expect(budgetWarning(40000, 50000)).toBeNull();
  });
});

describe("capOfferToCampaign", () => {
  it("clamps to campaign max", () => {
    expect(capOfferToCampaign(70000, 50000)).toEqual({ cents: 50000, capped: true });
  });
  it("passes through within budget", () => {
    expect(capOfferToCampaign(40000, 50000)).toEqual({ cents: 40000, capped: false });
  });
  it("is unrestricted when no campaign max (1:1)", () => {
    expect(capOfferToCampaign(999999, null)).toEqual({ cents: 999999, capped: false });
  });
});
