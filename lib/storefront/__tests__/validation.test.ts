import { describe, it, expect } from "vitest";
import {
  parseHandle, parsePriceCents, parseTags,
  parseIntInRange, parseMediaUrl, parseText,
} from "@/lib/storefront/validation";

describe("parseHandle", () => {
  it("lowercases and trims valid handles", () => {
    expect(parseHandle("  MyHandle_1 ")).toBe("myhandle_1");
  });
  it("rejects bad handles", () => {
    expect(parseHandle("ab")).toBeNull();            // too short
    expect(parseHandle("a".repeat(31))).toBeNull();  // too long
    expect(parseHandle("has space")).toBeNull();
    expect(parseHandle("dash-ed")).toBeNull();
    expect(parseHandle("")).toBeNull();
  });
});

describe("parsePriceCents", () => {
  it("converts dollars to integer cents", () => {
    expect(parsePriceCents("250")).toBe(25000);
    expect(parsePriceCents("99.99")).toBe(9999);
    expect(parsePriceCents(" 1.5 ")).toBe(150);
  });
  it("rejects invalid prices", () => {
    expect(parsePriceCents("0")).toBeNull();
    expect(parsePriceCents("0.99")).toBeNull();      // below $1 floor
    expect(parsePriceCents("1000000.01")).toBeNull();
    expect(parsePriceCents("12.345")).toBeNull();    // 3 decimals
    expect(parsePriceCents("abc")).toBeNull();
    expect(parsePriceCents("-5")).toBeNull();
  });
  it("never produces float drift", () => {
    expect(parsePriceCents("19.99")).toBe(1999);     // not 1998.9999…
  });
});

describe("parseTags", () => {
  it("splits, trims, lowercases, dedupes, drops empties", () => {
    expect(parseTags(" Gaming, tech,, GAMING , beauty ")).toEqual([
      "gaming", "tech", "beauty",
    ]);
  });
  it("caps count and length", () => {
    expect(parseTags("a,b,c", 2)).toEqual(["a", "b"]);
    expect(parseTags("x".repeat(31))).toEqual([]);
  });
});

describe("parseIntInRange", () => {
  it("parses in-range integers", () => {
    expect(parseIntInRange("14", 1, 90)).toBe(14);
  });
  it("rejects out-of-range and non-integers", () => {
    expect(parseIntInRange("0", 1, 90)).toBeNull();
    expect(parseIntInRange("91", 1, 90)).toBeNull();
    expect(parseIntInRange("2.5", 1, 90)).toBeNull();
    expect(parseIntInRange("", 1, 90)).toBeNull();
  });
});

describe("parseMediaUrl", () => {
  it("accepts absolute http(s) urls", () => {
    expect(parseMediaUrl("https://youtube.com/watch?v=x")).toBe("https://youtube.com/watch?v=x");
  });
  it("rejects other schemes and garbage", () => {
    expect(parseMediaUrl("javascript:alert(1)")).toBeNull();
    expect(parseMediaUrl("ftp://x")).toBeNull();
    expect(parseMediaUrl("not a url")).toBeNull();
  });
});

describe("parseText", () => {
  it("trims and enforces max length", () => {
    expect(parseText("  hi  ", 10)).toBe("hi");
    expect(parseText("", 10)).toBeNull();
    expect(parseText("x".repeat(11), 10)).toBeNull();
  });
});
