import { describe, it, expect } from "vitest";
import { canTransition, TRANSITIONS } from "@/lib/deals/machine";

describe("deal state machine", () => {
  it("escrow: requested can only be funded (system), not accepted directly", () => {
    expect(canTransition("requested", "fund", "system", "escrow")).toBeTruthy();
    expect(canTransition("requested", "accept", "creator", "escrow")).toBeUndefined();
  });

  it("off_platform: creator accepts straight from requested; fund is illegal", () => {
    expect(canTransition("requested", "accept", "creator", "off_platform")).toBeTruthy();
    expect(canTransition("requested", "fund", "system", "off_platform")).toBeUndefined();
  });

  it("escrow: creator accepts from funded", () => {
    expect(canTransition("funded", "accept", "creator", "escrow")).toBeTruthy();
  });

  it("actor is enforced: brand cannot accept", () => {
    expect(canTransition("funded", "accept", "brand", "escrow")).toBeUndefined();
  });

  it("happy path reaches completed in both modes", () => {
    for (const mode of ["escrow", "off_platform"] as const) {
      let s: string =
        mode === "escrow"
          ? canTransition("requested", "fund", "system", mode)!.to
          : "requested";
      s = canTransition(s as any, "accept", "creator", mode)!.to;
      s = canTransition(s as any, "begin_production", "creator", mode)!.to;
      s = canTransition(s as any, "submit_preview", "creator", mode)!.to;
      s = canTransition(s as any, "mark_published", "creator", mode)!.to;
      s = canTransition(s as any, "approve", "brand", mode)!.to;
      expect(s).toBe("completed");
    }
  });

  it("revision loop: submitted -> revision_requested -> submitted", () => {
    expect(canTransition("submitted", "request_revision", "brand", "escrow")!.to)
      .toBe("revision_requested");
    expect(canTransition("revision_requested", "submit_preview", "creator", "escrow")!.to)
      .toBe("submitted");
  });

  it("timers: expire_accept cancels, auto_approve completes", () => {
    expect(canTransition("funded", "expire_accept", "system", "escrow")!.to).toBe("cancelled");
    expect(canTransition("requested", "expire_accept", "system", "off_platform")!.to).toBe("cancelled");
    expect(canTransition("published", "auto_approve", "system", "escrow")!.to).toBe("completed");
  });

  it("disputes: raisable mid-flight by either side, resolved only by admin", () => {
    expect(canTransition("in_production", "dispute", "brand", "escrow")).toBeTruthy();
    expect(canTransition("submitted", "dispute", "creator", "off_platform")).toBeTruthy();
    expect(canTransition("disputed", "resolve_release", "admin", "escrow")!.to).toBe("completed");
    expect(canTransition("disputed", "resolve_refund", "admin", "escrow")!.to).toBe("cancelled");
    expect(canTransition("disputed", "resolve_release", "brand", "escrow")).toBeUndefined();
  });

  it("terminal states have no outgoing transitions", () => {
    expect(TRANSITIONS.filter((t) => t.from === "completed" || t.from === "cancelled"))
      .toHaveLength(0);
  });

  it("brand can cancel any state up through in_production, but not after submission", () => {
    expect(canTransition("requested", "cancel", "brand", "escrow")).toBeTruthy();
    expect(canTransition("requested", "cancel", "brand", "off_platform")).toBeTruthy();
    expect(canTransition("funded", "cancel", "brand", "escrow")).toBeTruthy();
    expect(canTransition("accepted", "cancel", "brand", "escrow")).toBeTruthy();
    expect(canTransition("in_production", "cancel", "brand", "off_platform")).toBeTruthy();
    expect(canTransition("submitted", "cancel", "brand", "escrow")).toBeUndefined();
    expect(canTransition("revision_requested", "cancel", "brand", "escrow")).toBeUndefined();
  });

  it("creator declines from the mode-correct pre-accept state", () => {
    expect(canTransition("funded", "decline", "creator", "escrow")!.to).toBe("cancelled");
    expect(canTransition("requested", "decline", "creator", "off_platform")!.to).toBe("cancelled");
    expect(canTransition("requested", "decline", "creator", "escrow")).toBeUndefined();
  });
});
