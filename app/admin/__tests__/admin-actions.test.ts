import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error("REDIRECT"), { url });
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/analytics", () => ({
  trackServerEvent: vi.fn(),
  identifyServerUser: vi.fn(),
}));
vi.mock("@/lib/email", () => ({
  emailUser: vi.fn().mockResolvedValue(undefined),
}));

import { createMockSupabase } from "@/app/__tests__/helpers/mock-supabase";
const mockSb = createMockSupabase();
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: vi.fn(() => Promise.resolve(mockSb.supabase)),
}));

const requireRoleMock = vi.fn().mockResolvedValue({
  user: { id: "admin1" },
  role: "admin",
});
vi.mock("@/lib/auth/require", () => ({
  requireRole: (...a: unknown[]) => requireRoleMock(...a),
}));

import { createServerSupabase } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  resolveDispute,
  resolveReport,
  setCreatorSuspension,
} from "../actions";

/**
 * Produces a fully-thenable mutation chain where every chaining method
 * returns `this`. Used for queries like `.update({}).eq(...)` that escape
 * the default mock-supabase thenable wrapper after the first `.eq()` call.
 */
function makeMutationChain(error: any): any {
  const chain: any = {
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    then: (resolve: any) => resolve({ data: null, error }),
  };
  return chain;
}

/**
 * Produces a chain that resolves `.maybeSingle()` with provided data/error.
 * Used when a `.from()` call needs to return a specific row via `.maybeSingle()`.
 */
function makeMaybeSingleChain(data: unknown, error: unknown = null): any {
  const chain: any = {};
  for (const m of ["select", "eq", "neq", "not", "in", "order", "limit"]) {
    chain[m] = vi.fn(() => chain);
  }
  chain.maybeSingle = vi.fn(() => Promise.resolve({ data, error }));
  return chain;
}

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

async function catchRedirect(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    throw new Error("Expected redirect but none was thrown");
  } catch (e: unknown) {
    if (e && typeof e === "object" && "url" in e) return (e as { url: string }).url;
    throw e;
  }
}

beforeEach(() => {
  mockSb.reset();
  vi.mocked(createServerSupabase).mockResolvedValue(mockSb.supabase as any);
  requireRoleMock.mockResolvedValue({ user: { id: "admin1" }, role: "admin" });
});

/* ================================================================
   resolveDispute
   ================================================================ */
describe("resolveDispute", () => {
  it("rejects unknown resolution value", async () => {
    const url = await catchRedirect(() =>
      resolveDispute(fd({ deal_id: "d1", resolution: "void" }))
    );
    expect(decodeURIComponent(url)).toContain("Unknown resolution");
  });

  it("maps 'release' to transition_deal with resolve_release", async () => {
    mockSb.mockRpc("transition_deal", { data: null, error: null });

    const url = await catchRedirect(() =>
      resolveDispute(fd({ deal_id: "d1", resolution: "release" }))
    );
    expect(url).toContain("/admin/deals/d1?resolved=1");
  });

  it("maps 'refund' to transition_deal with resolve_refund", async () => {
    mockSb.mockRpc("transition_deal", { data: null, error: null });

    const url = await catchRedirect(() =>
      resolveDispute(fd({ deal_id: "d1", resolution: "refund" }))
    );
    expect(url).toContain("/admin/deals/d1?resolved=1");
  });

  it("redirects with friendlyDbError on RPC failure", async () => {
    mockSb.mockRpc("transition_deal", {
      data: null,
      error: { code: "P0001", message: "Deal not in disputed state" },
    });

    const url = await catchRedirect(() =>
      resolveDispute(fd({ deal_id: "d1", resolution: "release" }))
    );
    expect(decodeURIComponent(url)).toContain("Deal not in disputed state");
  });
});

/* ================================================================
   resolveReport
   ================================================================ */
describe("resolveReport", () => {
  it("rejects empty resolution text", async () => {
    const url = await catchRedirect(() =>
      resolveReport(fd({ report_id: "r1", resolution: "" }))
    );
    expect(decodeURIComponent(url)).toContain("Write a short resolution note");
  });

  it("rejects resolution over 500 chars", async () => {
    const url = await catchRedirect(() =>
      resolveReport(fd({ report_id: "r1", resolution: "x".repeat(501) }))
    );
    expect(decodeURIComponent(url)).toContain("Write a short resolution note");
  });

  it("updates report and redirects to /admin?saved=1", async () => {
    mockSb.mockResult("reports", "update", { error: null });

    const url = await catchRedirect(() =>
      resolveReport(fd({ report_id: "r1", resolution: "Warned the user" }))
    );
    expect(url).toBe("/admin?saved=1");
  });

  it("redirects with friendlyDbError on update failure", async () => {
    // .update({}).eq() escapes the default thenable wrapper — use a fully-thenable
    // mutation chain via mockImplementationOnce instead of mockResult
    vi.mocked(mockSb.supabase.from).mockImplementationOnce(() =>
      makeMutationChain({ code: "23000", message: "constraint" })
    );

    const url = await catchRedirect(() =>
      resolveReport(fd({ report_id: "r1", resolution: "Resolved" }))
    );
    expect(url).toContain("error=");
  });
});

/* ================================================================
   setCreatorSuspension
   ================================================================ */
describe("setCreatorSuspension", () => {
  it("suspends creator (suspend=true → status 'suspended')", async () => {
    mockSb.mockResult("creator_profiles", "maybeSingle", {
      data: { handle: "jane", status: "live" },
      error: null,
    });
    mockSb.mockResult("creator_profiles", "update", { error: null });

    const url = await catchRedirect(() =>
      setCreatorSuspension(fd({ user_id: "cr1", suspend: "true" }))
    );
    expect(url).toBe("/admin?saved=1");
  });

  it("unsuspends creator to 'draft' (never re-publishes)", async () => {
    mockSb.mockResult("creator_profiles", "maybeSingle", {
      data: { handle: "jane", status: "suspended" },
      error: null,
    });
    mockSb.mockResult("creator_profiles", "update", { error: null });

    const url = await catchRedirect(() =>
      setCreatorSuspension(fd({ user_id: "cr1", suspend: "false" }))
    );
    expect(url).toBe("/admin?saved=1");
  });

  it("redirects with error when creator_profile read fails", async () => {
    mockSb.mockResult("creator_profiles", "maybeSingle", {
      data: null,
      error: { code: "42000", message: "Not found" },
    });

    const url = await catchRedirect(() =>
      setCreatorSuspension(fd({ user_id: "cr1", suspend: "true" }))
    );
    expect(url).toContain("error=");
  });

  it("redirects with error when no creator profile exists", async () => {
    mockSb.mockResult("creator_profiles", "maybeSingle", {
      data: null,
      error: null,
    });

    const url = await catchRedirect(() =>
      setCreatorSuspension(fd({ user_id: "cr1", suspend: "true" }))
    );
    expect(url).toContain("error=");
  });

  it("redirects with error when update fails", async () => {
    // setCreatorSuspension calls .from("creator_profiles") twice:
    //   1. select().eq().maybeSingle() → success
    //   2. update({}).eq()             → error (escapes default thenable)
    // Use two mockImplementationOnce calls so each from() call gets the right chain.
    vi.mocked(mockSb.supabase.from)
      .mockImplementationOnce(() =>
        makeMaybeSingleChain({ handle: "jane", status: "live" })
      )
      .mockImplementationOnce(() =>
        makeMutationChain({ code: "23000", message: "update fail" })
      );

    const url = await catchRedirect(() =>
      setCreatorSuspension(fd({ user_id: "cr1", suspend: "true" }))
    );
    expect(url).toContain("error=");
  });

  it("revalidates /c/{handle} on success", async () => {
    mockSb.mockResult("creator_profiles", "maybeSingle", {
      data: { handle: "jane", status: "live" },
      error: null,
    });
    mockSb.mockResult("creator_profiles", "update", { error: null });

    await catchRedirect(() =>
      setCreatorSuspension(fd({ user_id: "cr1", suspend: "true" }))
    );

    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith("/c/jane");
  });
});
