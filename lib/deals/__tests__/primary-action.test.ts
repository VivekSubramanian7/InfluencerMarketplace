import { describe, it, expect } from "vitest";
import { primaryActionLabel } from "@/lib/deals/ui-actions";

describe("primaryActionLabel", () => {
  it("creator on requested (off_platform): Accept deal", () => {
    expect(primaryActionLabel("requested", "creator", "off_platform")).toBe("Accept deal");
  });

  it("creator on in_production: Start production — wait, that's accepted", () => {
    expect(primaryActionLabel("accepted", "creator", "off_platform")).toBe("Start production");
  });

  it("brand on submitted: Request changes", () => {
    expect(primaryActionLabel("submitted", "brand", "off_platform")).toBe("Request changes");
  });

  it("brand on published: Approve & complete", () => {
    expect(primaryActionLabel("published", "brand", "off_platform")).toBe("Approve & complete");
  });

  it("terminal states return null", () => {
    expect(primaryActionLabel("completed", "brand", "off_platform")).toBeNull();
    expect(primaryActionLabel("cancelled", "creator", "off_platform")).toBeNull();
  });

  it("disputed returns null (no non-confirm actions)", () => {
    expect(primaryActionLabel("disputed", "brand", "off_platform")).toBeNull();
  });
});
