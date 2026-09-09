import { describe, it, expect } from "vitest";
import { responseTimeMs } from "../response-time";

describe("responseTimeMs", () => {
  it("computes elapsed ms", () => {
    expect(responseTimeMs("2026-01-01T00:00:00Z", "2026-01-01T01:00:00Z")).toBe(3600000);
  });
  it("returns null when unresponded", () => {
    expect(responseTimeMs("2026-01-01T00:00:00Z", null)).toBeNull();
  });
});
