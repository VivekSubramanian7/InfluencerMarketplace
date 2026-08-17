import { describe, it, expect } from "vitest";
import { actionsFor } from "@/lib/deals/ui-actions";

const acts = (s: Parameters<typeof actionsFor>[0], r: "brand" | "creator",
              m: Parameters<typeof actionsFor>[2] = "off_platform") =>
  actionsFor(s, r, m).map((a) => a.action);

describe("actionsFor", () => {
  it("creator on a fresh off_platform request: accept or decline", () => {
    expect(acts("requested", "creator")).toEqual(["accept", "decline"]);
  });

  it("brand on a fresh request: cancel only", () => {
    expect(acts("requested", "brand")).toEqual(["cancel"]);
  });

  it("accepted: creator starts production or cancels; brand can cancel or dispute? (no dispute pre-flight per machine)", () => {
    expect(acts("accepted", "creator")).toEqual(["begin_production", "cancel", "dispute"]);
    expect(acts("accepted", "brand")).toEqual(["cancel", "dispute"]);
  });

  it("submitted: brand approves-revision loop; creator publishes", () => {
    expect(acts("submitted", "brand")).toEqual(["request_revision", "dispute"]);
    expect(acts("submitted", "creator")).toEqual(["mark_published", "dispute"]);
  });

  it("published: brand approves; creator can only dispute", () => {
    expect(acts("published", "brand")).toEqual(["approve", "dispute"]);
    expect(acts("published", "creator")).toEqual(["dispute"]);
  });

  it("terminal states expose nothing", () => {
    expect(acts("completed", "brand")).toEqual([]);
    expect(acts("cancelled", "creator")).toEqual([]);
  });

  it("deliverable actions carry their URL requirement", () => {
    const submit = actionsFor("in_production", "creator", "off_platform")
      .find((a) => a.action === "submit_preview");
    expect(submit?.needsUrl).toBe("preview_url");
    const publish = actionsFor("submitted", "creator", "off_platform")
      .find((a) => a.action === "mark_published");
    expect(publish?.needsUrl).toBe("live_url");
  });

  it("destructive actions require confirmation", () => {
    for (const a of actionsFor("accepted", "brand", "off_platform")) {
      if (a.action === "cancel" || a.action === "dispute") expect(a.confirm).toBe(true);
    }
  });

  it("escrow mode: creator cannot accept before funding", () => {
    expect(acts("requested", "creator", "escrow")).toEqual([]);
    expect(acts("funded", "creator", "escrow")).toEqual(["accept", "decline"]);
  });
});
