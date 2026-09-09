import { describe, it, expect } from "vitest";
import * as t from "../taxonomy";

describe("taxonomy", () => {
  it("uses the agreed verbs", () => {
    expect(t.OFFER_VERB).toBe("Send offer");
    expect(t.CAMPAIGN_VERB).toBe("Send campaign");
    expect(t.CAMPAIGN_INVITE_CTA).toBe("Invite to campaign");
  });
});
