import { describe, it, expect } from "vitest";
import { parseFilterTokens, toSearchParams } from "@/lib/filters/tokens";

describe("filter tokens", () => {
  it("reads known keys and ignores junk", () => {
    const sp = new URLSearchParams("status=submitted&foo=bar");
    expect(parseFilterTokens(sp, ["status", "role"])).toEqual([
      { key: "status", label: "Status", value: "submitted" },
    ]);
  });
  it("round-trips", () => {
    const tokens = [{ key: "status", label: "Status", value: "accepted" }];
    expect(toSearchParams(tokens).get("status")).toBe("accepted");
  });
});
