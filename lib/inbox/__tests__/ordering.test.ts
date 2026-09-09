import { describe, it, expect } from "vitest";
import { sortConversationsByActivity } from "../ordering";

describe("sortConversationsByActivity", () => {
  it("orders by lastActivityAt desc, falling back to createdAt", () => {
    const rows = [
      { id: "a", lastActivityAt: "2026-01-01T00:00:00Z", createdAt: "2025-01-01T00:00:00Z" },
      { id: "b", lastActivityAt: null, createdAt: "2026-02-01T00:00:00Z" },
      { id: "c", lastActivityAt: "2026-03-01T00:00:00Z", createdAt: "2020-01-01T00:00:00Z" },
    ];
    expect(sortConversationsByActivity(rows).map((r) => r.id)).toEqual(["c", "b", "a"]);
  });
});
