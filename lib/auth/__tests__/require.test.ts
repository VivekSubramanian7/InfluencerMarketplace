import { describe, it, expect } from "vitest";
import { gateDecision } from "@/lib/auth/require";
import { homeForRole } from "@/lib/auth/home";

describe("homeForRole", () => {
  it("keeps each role inside the app", () => {
    expect(homeForRole("creator")).toBe("/dashboard");
    expect(homeForRole("brand")).toBe("/brand");
    expect(homeForRole("admin")).toBe("/admin");
  });
});

describe("gateDecision", () => {
  it("no user -> redirect to /login", () => {
    expect(gateDecision(null, null, null)).toEqual({ redirect: "/login" });
  });
  it("user without required role -> redirect to that user's in-app home", () => {
    expect(gateDecision({ id: "u1" }, "brand", "creator")).toEqual({ redirect: "/brand" });
    expect(gateDecision({ id: "u1" }, "creator", "brand")).toEqual({ redirect: "/dashboard" });
    expect(gateDecision({ id: "u1" }, "admin", "brand")).toEqual({ redirect: "/admin" });
  });
  it("user with required role -> pass", () => {
    expect(gateDecision({ id: "u1" }, "creator", "creator")).toEqual({ ok: true });
  });
  it("no role requirement -> any authed user passes", () => {
    expect(gateDecision({ id: "u1" }, "brand", null)).toEqual({ ok: true });
  });
});
