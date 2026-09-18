import { describe, it, expect } from "vitest";
import { createMockSupabase } from "../mock-supabase";

describe("createMockSupabase", () => {
  it("returns default null data for unknown tables", async () => {
    const { supabase } = createMockSupabase();
    const res = await supabase.from("anything").select("*").eq("id", "1").maybeSingle();
    expect(res).toEqual({ data: null, error: null, count: 0 });
  });

  it("returns configured result for a table + terminal", async () => {
    const { supabase, mockResult } = createMockSupabase();
    mockResult("profiles", "single", { data: { role: "creator" } });
    const res = await supabase.from("profiles").select("role").eq("id", "u1").single();
    expect(res.data).toEqual({ role: "creator" });
  });

  it("supports insert as a thenable", async () => {
    const { supabase, mockResult } = createMockSupabase();
    mockResult("offerings", "insert", { error: null });
    const res = await supabase.from("offerings").insert({ title: "test" });
    expect(res.error).toBeNull();
  });

  it("supports rpc calls", async () => {
    const { supabase, mockRpc } = createMockSupabase();
    mockRpc("claim_creator_invite", { data: null, error: null });
    const res = await supabase.rpc("claim_creator_invite", { p_token: "abc" });
    expect(res.error).toBeNull();
  });

  it("supports auth methods", async () => {
    const { supabase, mockAuth } = createMockSupabase();
    mockAuth("signUp", { error: null });
    const res = await supabase.auth.signUp({ email: "a@b.c", password: "x" });
    expect(res.error).toBeNull();
  });

  it("supports auth getUser", async () => {
    const { supabase, mockAuth } = createMockSupabase();
    mockAuth("getUser", { data: { user: { id: "u1" } } });
    const res = await supabase.auth.getUser();
    expect((res.data as any).user.id).toBe("u1");
  });

  it("chaining with update().eq().select().maybeSingle() works", async () => {
    const { supabase, mockResult } = createMockSupabase();
    mockResult("offerings", "maybeSingle", { data: { id: "o1", title: "updated" }, error: null });
    const res = await supabase
      .from("offerings")
      .update({ title: "updated" })
      .eq("id", "o1")
      .select("id, title")
      .maybeSingle();
    expect(res.data).toEqual({ id: "o1", title: "updated" });
  });
});
