import { describe, it, expect } from "vitest";
import { toggleSelection } from "../selection";

describe("toggleSelection", () => {
  it("adds and removes ids", () => {
    let s = new Set<string>();
    s = toggleSelection(s, "a");
    expect([...s]).toEqual(["a"]);
    s = toggleSelection(s, "a");
    expect([...s]).toEqual([]);
  });
});
