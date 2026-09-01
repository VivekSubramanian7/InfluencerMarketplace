import { describe, it, expect } from "vitest";
import { parseDiscoveryFilters, PAGE_SIZE } from "@/lib/discovery/filters";

describe("parseDiscoveryFilters", () => {
  it("defaults on empty params", () => {
    expect(parseDiscoveryFilters({})).toEqual({
      q: null, niche: null, country: null, type: null,
      minPriceCents: null, maxPriceCents: null, page: 1, tab: "new",
    });
  });

  it("parses and normalizes all fields", () => {
    const f = parseDiscoveryFilters({
      q: "  Tech reviews ", niche: " Gaming ", country: " Germany ",
      type: "dedicated_video", min_price: "50", max_price: "500", page: "3",
      tab: "worked",
    });
    expect(f).toEqual({
      q: "Tech reviews", niche: "gaming", country: "Germany",
      type: "dedicated_video", minPriceCents: 5000, maxPriceCents: 50000, page: 3,
      tab: "worked",
    });
  });

  it("rejects invalid values to defaults, never throws", () => {
    const f = parseDiscoveryFilters({
      q: "x".repeat(81), niche: "y".repeat(31), type: "bogus",
      min_price: "-5", max_price: "abc", page: "0", tab: "bogus",
    });
    expect(f).toEqual({
      q: null, niche: null, country: null, type: null,
      minPriceCents: null, maxPriceCents: null, page: 1, tab: "new",
    });
  });

  it("swaps inverted price bounds", () => {
    const f = parseDiscoveryFilters({ min_price: "500", max_price: "50" });
    expect(f.minPriceCents).toBe(5000);
    expect(f.maxPriceCents).toBe(50000);
  });

  it("takes the first value of array params", () => {
    expect(parseDiscoveryFilters({ q: ["a", "b"] }).q).toBe("a");
  });

  it("exports PAGE_SIZE 12", () => {
    expect(PAGE_SIZE).toBe(12);
  });
});
