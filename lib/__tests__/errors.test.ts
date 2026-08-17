import { describe, it, expect } from "vitest";
import { friendlyDbError } from "@/lib/errors";

describe("friendlyDbError", () => {
  it("maps known codes", () => {
    expect(
      friendlyDbError(
        { code: "23505", message: "duplicate key value" },
        { "23505": "You already reviewed this deal" }
      )
    ).toBe("You already reviewed this deal");
    expect(
      friendlyDbError(
        { code: "42501", message: "new row violates row-level security" },
        { "42501": "You can only review completed deals you were part of" }
      )
    ).toBe("You can only review completed deals you were part of");
  });
  it("passes through our own raised business errors", () => {
    expect(
      friendlyDbError({ code: "P0001", message: "revision limit reached" })
    ).toBe("revision limit reached");
  });
  it("hides everything else behind a generic message", () => {
    expect(
      friendlyDbError({
        code: "23503",
        message: "fk violation on deals_creator_id",
      })
    ).toBe("Something went wrong — please try again.");
    expect(friendlyDbError(null)).toBe("Something went wrong — please try again.");
  });
});
