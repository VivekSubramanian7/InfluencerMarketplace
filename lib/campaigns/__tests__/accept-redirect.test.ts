import { describe, it, expect } from "vitest";
import { acceptRedirect } from "../accept-redirect";

describe("acceptRedirect", () => {
  it("prefers return_to when provided", () => {
    expect(acceptRedirect("/campaigns?c=abc", "deal1")).toBe("/campaigns?c=abc");
  });
  it("falls back to the deal page", () => {
    expect(acceptRedirect(null, "deal1")).toBe("/deals/deal1");
  });
});
