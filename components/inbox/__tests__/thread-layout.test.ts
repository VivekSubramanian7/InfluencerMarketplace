import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

describe("conversation thread layout", () => {
  it("thread has a scrollable messages region and a pinned footer", () => {
    const src = readFileSync("components/inbox/conversation-thread.tsx", "utf8");
    expect(src).toMatch(/flex-1 overflow-y-auto/);
    expect(src).toMatch(/border-t/);
    expect(src).toMatch(/SendOfferPanel/);
  });
});
