import { describe, it, expect } from "vitest";
import { reviewRevalidatePath } from "../[id]/review-target";

describe("reviewRevalidatePath", () => {
  it("brand profile path", () => {
    expect(reviewRevalidatePath("brand", "acme")).toBe("/brand/acme");
  });

  it("creator storefront path", () => {
    expect(reviewRevalidatePath("creator", "jane")).toBe("/c/jane");
  });
});
