import { describe, it, expect } from "vitest";
import { canTransition } from "../machine";

describe("barter product flow", () => {
  it("brand sends product from accepted", () => {
    expect(canTransition("accepted", "mark_product_sent", "brand", "barter")).toBeTruthy();
  });

  it("creator receives product, then submits preview", () => {
    expect(canTransition("product_sent", "mark_product_received", "creator", "barter")).toBeTruthy();
    expect(canTransition("product_received", "submit_preview", "creator", "barter")).toBeTruthy();
  });

  it("non-barter can still submit preview directly from accepted", () => {
    expect(canTransition("accepted", "submit_preview", "creator", "off_platform")).toBeTruthy();
    expect(canTransition("accepted", "submit_preview", "creator", "escrow")).toBeTruthy();
  });

  it("barter deals cannot submit preview directly from accepted", () => {
    expect(canTransition("accepted", "submit_preview", "creator", "barter")).toBeUndefined();
  });
});
