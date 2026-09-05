import { describe, it, expect } from "vitest";
import { actionsFor } from "@/lib/deals/ui-actions";

const acts = (s: Parameters<typeof actionsFor>[0], r: "brand" | "creator",
              m: Parameters<typeof actionsFor>[2] = "off_platform",
              rc = 0, rl = 1) =>
  actionsFor(s, r, m, rc, rl).map((a) => a.action);

describe("actionsFor (8 states)", () => {
  it("creator on requested: accept or decline", () => {
    expect(acts("requested", "creator")).toEqual(["accept", "decline"]);
  });

  it("brand on requested: cancel only", () => {
    expect(acts("requested", "brand")).toEqual(["cancel"]);
  });

  it("accepted: creator submits preview or cancels; brand can cancel or dispute", () => {
    expect(acts("accepted", "creator")).toEqual(["submit_preview", "cancel", "dispute"]);
    expect(acts("accepted", "brand")).toEqual(["cancel", "dispute"]);
  });

  it("submitted: brand approves-preview or requests revision; creator publishes", () => {
    expect(acts("submitted", "brand")).toEqual(["approve_preview", "request_revision", "dispute"]);
    expect(acts("submitted", "creator")).toEqual(["mark_published", "dispute"]);
  });

  it("submitted with revisions exhausted: brand gets approve_preview only (no request_revision)", () => {
    expect(acts("submitted", "brand", "off_platform", 2, 2))
      .toEqual(["approve_preview", "dispute"]);
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
    const submit = actionsFor("accepted", "creator", "off_platform")
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

  it("request changes requires a note", () => {
    const a = actionsFor("submitted", "brand", "off_platform")
      .find((x) => x.action === "request_revision");
    expect(a?.needsNote).toBe(true);
  });

  it("approve is the brand action on published, with preview", () => {
    const a = actionsFor("published", "brand", "off_platform")
      .find((x) => x.action === "approve");
    expect(a?.needsPreview).toBe(true);
  });
});
