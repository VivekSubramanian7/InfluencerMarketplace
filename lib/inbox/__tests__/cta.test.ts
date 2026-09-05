import { describe, it, expect } from "vitest";
import { inboxCta } from "@/lib/inbox/cta";

describe("inboxCta", () => {
  it("creator on an invite sees Accept, not Send offer", () => {
    expect(inboxCta({ role: "creator", convStatus: "invited", hasPendingOffer: false }).kind)
      .toBe("accept_invite");
  });
  it("brand on an invite waits", () => {
    expect(inboxCta({ role: "brand", convStatus: "invited", hasPendingOffer: false }).kind)
      .toBe("wait_invite");
  });
  it("creator with a pending offer sees Accept offer", () => {
    expect(
      inboxCta({ role: "creator", convStatus: "accepted", hasPendingOffer: true, pendingOfferId: "o1" })
    ).toEqual({ kind: "accept_offer", offerId: "o1" });
  });
  it("brand with no pending offer may send one", () => {
    expect(inboxCta({ role: "brand", convStatus: "accepted", hasPendingOffer: false }).kind)
      .toBe("send_offer");
  });
  it("brand with a pending offer does not see Send offer", () => {
    expect(inboxCta({ role: "brand", convStatus: "accepted", hasPendingOffer: true }).kind)
      .toBe("chat");
  });
});
