import { describe, it, expect } from "vitest";
import { inviteRedirect } from "../invite-redirect";

describe("inviteRedirect", () => {
  it("opens the conversation for a single invite", () => {
    expect(inviteRedirect("conv1", 1)).toBe("/inbox?c=conv1");
  });
  it("returns to inbox list for bulk", () => {
    expect(inviteRedirect(null, 5)).toBe("/inbox?sent=5");
  });
});
