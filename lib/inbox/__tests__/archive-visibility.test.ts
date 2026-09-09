import { describe, it, expect } from "vitest";
import { isArchivedForUser } from "../archive";

describe("isArchivedForUser", () => {
  const base = { brand_id: "b", creator_id: "c", archived_by_brand_at: null, archived_by_creator_at: null };
  it("is archived for the brand when brand timestamp set", () => {
    expect(isArchivedForUser({ ...base, archived_by_brand_at: "2026-01-01" }, "b")).toBe(true);
    expect(isArchivedForUser({ ...base, archived_by_brand_at: "2026-01-01" }, "c")).toBe(false);
  });
});
