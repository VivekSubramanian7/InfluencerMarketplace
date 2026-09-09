import { describe, it, expect } from "vitest";
import { liveCampaigns } from "../live-campaigns";

describe("liveCampaigns", () => {
  it("returns only open campaigns owned by the brand", () => {
    const rows = [
      { id: "1", status: "open" },
      { id: "2", status: "closed" },
    ];
    expect(liveCampaigns(rows).map((c) => c.id)).toEqual(["1"]);
  });
});
