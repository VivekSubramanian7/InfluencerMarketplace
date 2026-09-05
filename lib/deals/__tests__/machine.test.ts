import { describe, it, expect } from "vitest";
import { canTransition, TRANSITIONS, type DealStatus } from "@/lib/deals/machine";

describe("deal state machine (8 states)", () => {
  it("creator accepts directly from requested (no funding gate)", () => {
    expect(canTransition("requested", "accept", "creator", "off_platform")).toBeTruthy();
  });

  it("fund action does not exist", () => {
    expect(canTransition("requested", "fund" as any, "system", "off_platform")).toBeUndefined();
  });

  it("actor is enforced: brand cannot accept", () => {
    expect(canTransition("requested", "accept", "brand", "off_platform")).toBeUndefined();
  });

  it("happy path: requested -> accepted -> submitted -> published -> completed", () => {
    let s: DealStatus = "requested";
    s = canTransition(s, "accept", "creator", "off_platform")!.to;
    expect(s).toBe("accepted");
    s = canTransition(s, "submit_preview", "creator", "off_platform")!.to;
    expect(s).toBe("submitted");
    s = canTransition(s, "mark_published", "creator", "off_platform")!.to;
    expect(s).toBe("published");
    s = canTransition(s, "approve", "brand", "off_platform")!.to;
    expect(s).toBe("completed");
  });

  it("approve_preview is a signal: from submitted stays submitted", () => {
    const t = canTransition("submitted", "approve_preview", "brand", "off_platform");
    expect(t).toBeTruthy();
    expect(t!.to).toBe("submitted");
  });

  it("revision loop: submitted -> revision_requested -> submitted", () => {
    expect(canTransition("submitted", "request_revision", "brand", "off_platform")!.to)
      .toBe("revision_requested");
    expect(canTransition("revision_requested", "submit_preview", "creator", "off_platform")!.to)
      .toBe("submitted");
  });

  it("timers: expire_accept cancels, auto_approve completes", () => {
    expect(canTransition("requested", "expire_accept", "system", "off_platform")!.to).toBe("cancelled");
    expect(canTransition("published", "auto_approve", "system", "off_platform")!.to).toBe("completed");
  });

  it("disputes: raisable from accepted/submitted/revision_requested/published", () => {
    expect(canTransition("accepted", "dispute", "brand", "off_platform")).toBeTruthy();
    expect(canTransition("submitted", "dispute", "creator", "off_platform")).toBeTruthy();
    expect(canTransition("disputed", "resolve_release", "admin", "off_platform")!.to).toBe("completed");
    expect(canTransition("disputed", "resolve_refund", "admin", "off_platform")!.to).toBe("cancelled");
    expect(canTransition("disputed", "resolve_release", "brand", "off_platform")).toBeUndefined();
  });

  it("terminal states have no outgoing transitions", () => {
    expect(TRANSITIONS.filter((t) => t.from === "completed" || t.from === "cancelled"))
      .toHaveLength(0);
  });

  it("brand can cancel requested and accepted, not after submission", () => {
    expect(canTransition("requested", "cancel", "brand", "off_platform")).toBeTruthy();
    expect(canTransition("accepted", "cancel", "brand", "off_platform")).toBeTruthy();
    expect(canTransition("submitted", "cancel", "brand", "off_platform")).toBeUndefined();
  });

  it("creator declines from requested", () => {
    expect(canTransition("requested", "decline", "creator", "off_platform")!.to).toBe("cancelled");
  });

  it("no in_production or funded states exist in transitions", () => {
    expect(TRANSITIONS.some((t) => t.from === "funded" as any || t.to === "funded" as any)).toBe(false);
    expect(TRANSITIONS.some((t) => t.from === "in_production" as any || t.to === "in_production" as any)).toBe(false);
  });
});
