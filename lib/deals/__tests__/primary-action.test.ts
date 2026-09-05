import { describe, it, expect } from "vitest";
import { primaryActionLabel } from "@/lib/deals/ui-actions";

describe("primaryActionLabel (8 states)", () => {
  it("creator on requested: Accept deal", () => {
    expect(primaryActionLabel("requested", "creator", "off_platform")).toBe("Accept deal");
  });

  it("creator on accepted: Submit preview (no more Start production)", () => {
    expect(primaryActionLabel("accepted", "creator", "off_platform")).toBe("Submit preview");
  });

  it("brand on submitted: Approve preview", () => {
    expect(primaryActionLabel("submitted", "brand", "off_platform")).toBe("Approve preview");
  });

  it("brand on published: Approve & complete", () => {
    expect(primaryActionLabel("published", "brand", "off_platform")).toBe("Approve & complete");
  });

  it("terminal states return null", () => {
    expect(primaryActionLabel("completed", "brand", "off_platform")).toBeNull();
    expect(primaryActionLabel("cancelled", "creator", "off_platform")).toBeNull();
  });

  it("disputed returns null", () => {
    expect(primaryActionLabel("disputed", "brand", "off_platform")).toBeNull();
  });
});
