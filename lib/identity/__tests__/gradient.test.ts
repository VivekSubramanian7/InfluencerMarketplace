import { describe, it, expect } from "vitest";
import { creatorGradient } from "@/lib/identity/gradient";

describe("creatorGradient", () => {
  it("is deterministic — same handle, same gradient", () => {
    expect(creatorGradient("mayafilms")).toEqual(creatorGradient("mayafilms"));
  });

  it("different handles can differ", () => {
    const all = ["mayafilms", "techtom", "beautybelle", "gamerguy", "foodiefan"]
      .map((h) => creatorGradient(h).css);
    expect(new Set(all).size).toBeGreaterThan(1);
  });

  it("emits valid css gradient with both stops", () => {
    const g = creatorGradient("testcreator");
    expect(g.css).toMatch(/^linear-gradient\(\d+deg, #[0-9A-F]{6} 0%, #[0-9A-F]{6} 100%\)$/i);
    expect(g.css).toContain(g.from);
    expect(g.css).toContain(g.to);
    expect(g.deep).toBe(g.from);
  });
});
