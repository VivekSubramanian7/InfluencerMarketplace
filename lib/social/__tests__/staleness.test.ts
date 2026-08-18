import { describe, it, expect } from "vitest";
import { isDueForSync, isStale } from "@/lib/social/staleness";

const NOW = new Date("2026-08-18T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 24 * 60 * 60 * 1000).toISOString();

describe("isDueForSync", () => {
  it("is due when never synced or unparsable", () => {
    expect(isDueForSync(null, NOW)).toBe(true);
    expect(isDueForSync("not-a-date", NOW)).toBe(true);
  });

  it("is not due inside the 7-day window", () => {
    expect(isDueForSync(daysAgo(0), NOW)).toBe(false);
    expect(isDueForSync(daysAgo(6.9), NOW)).toBe(false);
  });

  it("is due at and past 7 days", () => {
    expect(isDueForSync(daysAgo(7), NOW)).toBe(true);
    expect(isDueForSync(daysAgo(30), NOW)).toBe(true);
  });
});

describe("isStale", () => {
  it("never-synced rows are due but not stale", () => {
    expect(isStale(null, NOW)).toBe(false);
  });

  it("is stale only at and past 14 days", () => {
    expect(isStale(daysAgo(13.9), NOW)).toBe(false);
    expect(isStale(daysAgo(14), NOW)).toBe(true);
  });
});
