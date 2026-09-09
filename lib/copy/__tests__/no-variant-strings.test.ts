import { readFileSync } from "node:fs";
import { it, expect } from "vitest";

it("no ad-hoc 'Send an offer' variant in thread", () => {
  const a = readFileSync("components/inbox/conversation-thread.tsx", "utf8");
  expect(a.includes('"Send an offer"')).toBe(false);
});
