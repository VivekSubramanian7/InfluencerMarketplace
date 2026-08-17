import { describe, it, expect } from "vitest";
import { safeNext } from "@/lib/auth/require";

describe("safeNext", () => {
  it("accepts internal absolute paths", () => {
    expect(safeNext("/deals/abc")).toBe("/deals/abc");
    expect(safeNext("/discover?niche=gaming")).toBe("/discover?niche=gaming");
  });
  it("rejects protocol-relative, schemed, and relative junk", () => {
    expect(safeNext("//evil.com")).toBeNull();
    expect(safeNext("https://evil.com")).toBeNull();
    expect(safeNext("javascript:alert(1)")).toBeNull();
    expect(safeNext("deals")).toBeNull();
    expect(safeNext("")).toBeNull();
    expect(safeNext(null)).toBeNull();
    expect(safeNext(undefined)).toBeNull();
    expect(safeNext("/\\evil.com")).toBeNull();
    expect(safeNext("/a\\b")).toBeNull();
  });
});
