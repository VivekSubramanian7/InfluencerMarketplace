import { describe, it, expect } from "vitest";
import { computeVideoStats } from "@/lib/social/engagement";

describe("computeVideoStats", () => {
  it("averages views and per-view engagement across the sample", () => {
    const result = computeVideoStats([
      { views: 1000, likes: 100, comments: 10, shares: 10 }, // 12%
      { views: 3000, likes: 120, comments: 0, shares: 0 },   // 4%
    ]);
    expect(result.avgViews).toBe(2000);
    expect(result.engagementRate).toBe(8);
  });

  it("ignores videos without positive view counts", () => {
    const result = computeVideoStats([
      { views: null, likes: 500, comments: 50 },  // photo post / missing
      { views: 0, likes: 10, comments: 1 },
      { views: 200, likes: 20, comments: 0 },     // 10%
    ]);
    expect(result.avgViews).toBe(200);
    expect(result.engagementRate).toBe(10);
  });

  it("returns nulls for an empty or viewless sample", () => {
    expect(computeVideoStats([])).toEqual({ avgViews: null, engagementRate: null });
    expect(computeVideoStats([{ views: null, likes: 1, comments: 1 }])).toEqual({
      avgViews: null,
      engagementRate: null,
    });
  });

  it("computes avg views but null engagement when no interactions are known", () => {
    const result = computeVideoStats([{ views: 500, likes: null, comments: null }]);
    expect(result.avgViews).toBe(500);
    expect(result.engagementRate).toBeNull();
  });

  it("caps the sample at 12 videos and the rate at 999.99", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      views: i < 12 ? 100 : 1_000_000,
      likes: 10,
      comments: 0,
    }));
    expect(computeVideoStats(many).avgViews).toBe(100);

    const viral = computeVideoStats([{ views: 1, likes: 1000, comments: 0 }]);
    expect(viral.engagementRate).toBe(999.99);
  });

  it("rounds the rate to two decimals", () => {
    const result = computeVideoStats([{ views: 3000, likes: 100, comments: 0 }]);
    expect(result.engagementRate).toBe(3.33);
  });
});
