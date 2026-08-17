import { describe, it, expect } from "vitest";
import { gateDecision } from "@/lib/auth/require";

describe("gateDecision", () => {
  it("no user -> redirect to /login", () => {
    expect(gateDecision(null, null, null)).toEqual({ redirect: "/login" });
  });
  it("user without required role -> redirect home", () => {
    expect(gateDecision({ id: "u1" }, "brand", "creator")).toEqual({ redirect: "/" });
  });
  it("user with required role -> pass", () => {
    expect(gateDecision({ id: "u1" }, "creator", "creator")).toEqual({ ok: true });
  });
  it("no role requirement -> any authed user passes", () => {
    expect(gateDecision({ id: "u1" }, "brand", null)).toEqual({ ok: true });
  });
});
