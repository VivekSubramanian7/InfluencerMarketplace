// BEHAVIORAL NOTES (source vs brief discrepancies):
// - applyToCampaign: FormData key is "proposed_price" (not "price")
// - applyToCampaign: FormData key is "id" is not used; no "application_id" field
// - withdrawApplication: FormData key is "id" (not "application_id")
// - decideApplication: FormData key is "id" (not "application_id")
// - bulkDecideApplications: uses formData.getAll("application_ids") (not "ids" CSV)
// - applyToCampaign storefront check: queries creator_profiles for user_id,
//   then calls getOnboardingState() which queries multiple tables independently
//   (no storefront_complete/can_apply/has_required_channel on creator_profiles row)
// - decideApplication "declined" success: update().eq().select().maybeSingle()
//   → result key is "maybeSingle" (not "update") for the data/error
// - decideApplication "accepted" success: redirects to /deals/<dealId>
//   (via acceptRedirect() — no returnTo set in baseFd so it falls back to /deals/...)
// - bulkDecideApplications "declined" path also ends with .maybeSingle() per id

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks declared before hoisted vi.mock factories ─────────────────────────
// vi.mock() factories are hoisted to the top of the file by Vitest.
// To avoid TDZ issues, we must NOT reference module-scope `const` variables
// inside vi.mock() factory bodies. Instead, delegate to module-level functions
// or lazy closures that are only evaluated when the mock is called.

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

vi.mock("@/lib/auth/require", () => ({
  requireRole: vi.fn().mockResolvedValue({ user: { id: "u1" }, role: "creator" }),
  requireUser: vi.fn().mockResolvedValue({ user: { id: "u1" }, role: "creator" }),
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { redirect } from "next/navigation";
import { emailUser } from "@/lib/email";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  applyToCampaign,
  withdrawApplication,
  decideApplication,
  bulkDecideApplications,
} from "../[id]/actions";

// ─── Chain builders ───────────────────────────────────────────────────────────

/**
 * A fully-thenable mutation chain for .update().eq().eq() and similar patterns
 * that escape the default thenable wrapper in makeChain().
 */
function makeMutationChain(error: unknown): Record<string, unknown> {
  const chain: Record<string, unknown> = {};
  for (const m of ["insert", "update", "delete", "upsert", "eq", "neq", "select", "not"]) {
    chain[m] = vi.fn(() => chain);
  }
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: null, error }).then(resolve);
  return chain;
}

/**
 * A chain that resolves .maybeSingle() with the provided data.
 * Useful when the chained update().eq().select().maybeSingle() pattern is used.
 */
function makeMutationChainWithMaybeSingle(
  error: unknown,
  data: unknown,
): Record<string, unknown> {
  const chain: Record<string, unknown> = {};
  for (const m of ["insert", "update", "delete", "upsert", "eq", "neq", "not", "select"]) {
    chain[m] = vi.fn(() => chain);
  }
  chain.maybeSingle = vi.fn(() => Promise.resolve({ data, error }));
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: null, error }).then(resolve);
  return chain;
}

/**
 * A chain for select queries that need count support (head:true pattern).
 */
function makeCountChain(count: number): Record<string, unknown> {
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null, count }).then(resolve),
  };
  return chain;
}

/**
 * A chain that resolves .maybeSingle() directly with provided data.
 */
function makeMaybeSingleChain(data: unknown, error: unknown = null): Record<string, unknown> {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "neq", "not", "order", "limit"]) {
    chain[m] = vi.fn(() => chain);
  }
  chain.maybeSingle = vi.fn(() => Promise.resolve({ data, error }));
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data, error }).then(resolve);
  return chain;
}

// ─── beforeEach ───────────────────────────────────────────────────────────────

beforeEach(() => {
  // reset() calls vi.clearAllMocks() — re-apply mocks after
  mockSb.reset();
  vi.mocked(createServerSupabase).mockResolvedValue(mockSb.supabase as any);
  vi.mocked(redirect).mockImplementation((url: string) => {
    throw Object.assign(new Error("REDIRECT"), { url });
  });
  // requireRole defaults to creator role; tests override as needed
  vi.mocked(requireRole).mockResolvedValue({ user: { id: "u1" }, role: "creator" } as any);
});

// ─── applyToCampaign ──────────────────────────────────────────────────────────

describe("applyToCampaign", () => {
  // Note: FormData key is "proposed_price" in source (not "price")
  function baseFd(overrides: Record<string, string> = {}): FormData {
    const fd = new FormData();
    fd.set("campaign_id", "camp-1");
    fd.set("pitch", "I would love to work with you!");
    fd.set("proposed_price", "50");   // $50 → 5000 cents (valid: ≥$1, ≤$1M)
    for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
    return fd;
  }

  beforeEach(() => {
    vi.mocked(requireRole).mockResolvedValue({ user: { id: "u1" }, role: "creator" });
  });

  it("requires creator role", async () => {
    vi.mocked(requireRole).mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(applyToCampaign(baseFd())).rejects.toThrow("Unauthorized");
  });

  it("rejects empty pitch", async () => {
    const fd = baseFd({ pitch: "" });
    try {
      await applyToCampaign(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
    }
  });

  it("rejects pitch > 2000 chars", async () => {
    const fd = baseFd({ pitch: "P".repeat(2001) });
    try {
      await applyToCampaign(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
    }
  });

  it("rejects invalid price (non-numeric)", async () => {
    const fd = baseFd({ proposed_price: "not-a-number" });
    try {
      await applyToCampaign(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
    }
  });

  it("rejects zero price (below minimum)", async () => {
    // parsePriceCents: cents < 100 → null (minimum is $1 = 100 cents)
    const fd = baseFd({ proposed_price: "0" });
    try {
      await applyToCampaign(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
    }
  });

  it("redirects to /dashboard when no creator_profile", async () => {
    // creator_profiles query returns null via maybeSingle()
    mockSb.mockResult("creator_profiles", "maybeSingle", { data: null, error: null });
    const fd = baseFd();
    try {
      await applyToCampaign(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("/dashboard");
    }
  });

  it("redirects with completeness error when storefront incomplete (missing social)", async () => {
    // creator_profiles returns a profile so user passes the profile gate
    // getOnboardingState queries: creator_profiles, connected_accounts, offerings, portfolio_items
    // We mock: creator_profiles maybeSingle → has profile & is live
    //          connected_accounts count → 0 (missing social) → storefrontComplete = false
    //          offerings count → 1, portfolio_items count → 1
    vi.mocked(mockSb.supabase.from)
      // 1st call: creator_profiles (user_id check)
      .mockImplementationOnce(() => makeMaybeSingleChain({ user_id: "u1" }))
      // 2nd call: creator_profiles (onboarding state — handle & status)
      .mockImplementationOnce(() => makeMaybeSingleChain({ handle: "alice", status: "live" }))
      // 3rd call: connected_accounts (count = 0 → missing)
      .mockImplementationOnce(() => makeCountChain(0))
      // 4th call: offerings (count = 1)
      .mockImplementationOnce(() => makeCountChain(1))
      // 5th call: portfolio_items (count = 1)
      .mockImplementationOnce(() => makeCountChain(1));
    const fd = baseFd();
    try {
      await applyToCampaign(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
      expect(decodeURIComponent(e.url)).toMatch(/complete|storefront/i);
    }
  });

  it("redirects when creator cannot apply (offering type mismatch)", async () => {
    // Storefront is complete; no active offering matching campaign type
    vi.mocked(mockSb.supabase.from)
      // creator_profiles (user_id check)
      .mockImplementationOnce(() => makeMaybeSingleChain({ user_id: "u1" }))
      // creator_profiles (onboarding: handle & status)
      .mockImplementationOnce(() => makeMaybeSingleChain({ handle: "alice", status: "live" }))
      // connected_accounts count = 1
      .mockImplementationOnce(() => makeCountChain(1))
      // offerings count = 1
      .mockImplementationOnce(() => makeCountChain(1))
      // portfolio_items count = 1
      .mockImplementationOnce(() => makeCountChain(1))
      // campaigns .select(...).eq().maybeSingle() → campaign with offering_type ugc_video
      .mockImplementationOnce(() => makeMaybeSingleChain({
        id: "camp-1",
        brand_id: "b1",
        title: "Test",
        offering_type: "ugc_video",
        budget_max_cents: 100000,
        platforms: [],
      }))
      // offerings active types → empty array (no active offerings of any type)
      .mockImplementationOnce(() => {
        const chain: Record<string, unknown> = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          then: (resolve: (v: unknown) => unknown) =>
            Promise.resolve({ data: [], error: null }).then(resolve),
        };
        return chain;
      });
    const fd = baseFd();
    try {
      await applyToCampaign(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
    }
  });

  it("redirects when creator has no required channel", async () => {
    // Storefront complete; offering matches; but campaign has required platforms and creator lacks them
    vi.mocked(mockSb.supabase.from)
      // creator_profiles (user_id check)
      .mockImplementationOnce(() => makeMaybeSingleChain({ user_id: "u1" }))
      // creator_profiles (onboarding)
      .mockImplementationOnce(() => makeMaybeSingleChain({ handle: "alice", status: "live" }))
      // connected_accounts count = 1
      .mockImplementationOnce(() => makeCountChain(1))
      // offerings count = 1
      .mockImplementationOnce(() => makeCountChain(1))
      // portfolio_items count = 1
      .mockImplementationOnce(() => makeCountChain(1))
      // campaigns → requires instagram platform
      .mockImplementationOnce(() => makeMaybeSingleChain({
        id: "camp-1",
        brand_id: "b1",
        title: "Test",
        offering_type: "ugc_video",
        budget_max_cents: 100000,
        platforms: ["instagram"],
      }))
      // offerings (active types include ugc_video → can apply)
      .mockImplementationOnce(() => {
        const chain: Record<string, unknown> = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          then: (resolve: (v: unknown) => unknown) =>
            Promise.resolve({ data: [{ type: "ugc_video" }], error: null }).then(resolve),
        };
        return chain;
      })
      // connected_accounts platforms → tiktok only (not instagram)
      .mockImplementationOnce(() => {
        const chain: Record<string, unknown> = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          then: (resolve: (v: unknown) => unknown) =>
            Promise.resolve({ data: [{ platform: "tiktok" }], error: null }).then(resolve),
        };
        return chain;
      });
    const fd = baseFd();
    try {
      await applyToCampaign(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
    }
  });

  it("returns 'You already applied' on duplicate (23505)", async () => {
    // Full happy path up to insert, then insert returns 23505
    vi.mocked(mockSb.supabase.from)
      .mockImplementationOnce(() => makeMaybeSingleChain({ user_id: "u1" }))
      .mockImplementationOnce(() => makeMaybeSingleChain({ handle: "alice", status: "live" }))
      .mockImplementationOnce(() => makeCountChain(1))
      .mockImplementationOnce(() => makeCountChain(1))
      .mockImplementationOnce(() => makeCountChain(1))
      .mockImplementationOnce(() => makeMaybeSingleChain({
        id: "camp-1",
        brand_id: "b1",
        title: "Test",
        offering_type: "ugc_video",
        budget_max_cents: 100000,
        platforms: [],
      }))
      // offerings
      .mockImplementationOnce(() => {
        const chain: Record<string, unknown> = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          then: (resolve: (v: unknown) => unknown) =>
            Promise.resolve({ data: [{ type: "ugc_video" }], error: null }).then(resolve),
        };
        return chain;
      })
      // campaign_applications insert → 23505
      .mockImplementationOnce(() =>
        makeMutationChain({ message: "duplicate key", code: "23505" })
      );
    const fd = baseFd();
    try {
      await applyToCampaign(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(decodeURIComponent(e.url)).toMatch(/already.*applied/i);
    }
  });

  it("returns permission error on 42501", async () => {
    vi.mocked(mockSb.supabase.from)
      .mockImplementationOnce(() => makeMaybeSingleChain({ user_id: "u1" }))
      .mockImplementationOnce(() => makeMaybeSingleChain({ handle: "alice", status: "live" }))
      .mockImplementationOnce(() => makeCountChain(1))
      .mockImplementationOnce(() => makeCountChain(1))
      .mockImplementationOnce(() => makeCountChain(1))
      .mockImplementationOnce(() => makeMaybeSingleChain({
        id: "camp-1",
        brand_id: "b1",
        title: "Test",
        offering_type: "ugc_video",
        budget_max_cents: 100000,
        platforms: [],
      }))
      .mockImplementationOnce(() => {
        const chain: Record<string, unknown> = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          then: (resolve: (v: unknown) => unknown) =>
            Promise.resolve({ data: [{ type: "ugc_video" }], error: null }).then(resolve),
        };
        return chain;
      })
      .mockImplementationOnce(() =>
        makeMutationChain({ message: "permission denied", code: "42501" })
      );
    const fd = baseFd();
    try {
      await applyToCampaign(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(decodeURIComponent(e.url)).toMatch(/creator.*account|permission/i);
    }
  });

  it("redirects with saved=1 and emails brand on success", async () => {
    vi.mocked(mockSb.supabase.from)
      .mockImplementationOnce(() => makeMaybeSingleChain({ user_id: "u1" }))
      .mockImplementationOnce(() => makeMaybeSingleChain({ handle: "alice", status: "live" }))
      .mockImplementationOnce(() => makeCountChain(1))
      .mockImplementationOnce(() => makeCountChain(1))
      .mockImplementationOnce(() => makeCountChain(1))
      .mockImplementationOnce(() => makeMaybeSingleChain({
        id: "camp-1",
        brand_id: "b1",
        title: "Test Campaign",
        offering_type: "ugc_video",
        budget_max_cents: 100000,
        platforms: [],
      }))
      // offerings
      .mockImplementationOnce(() => {
        const chain: Record<string, unknown> = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          then: (resolve: (v: unknown) => unknown) =>
            Promise.resolve({ data: [{ type: "ugc_video" }], error: null }).then(resolve),
        };
        return chain;
      })
      // insert success
      .mockImplementationOnce(() => makeMutationChain(null));
    const fd = baseFd();
    try {
      await applyToCampaign(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("saved=1");
    }
    expect(vi.mocked(emailUser)).toHaveBeenCalled();
  });
});

// ─── withdrawApplication ──────────────────────────────────────────────────────

describe("withdrawApplication", () => {
  beforeEach(() => {
    vi.mocked(requireRole).mockResolvedValue({ user: { id: "u1" }, role: "creator" });
  });

  // Note: source uses formData.get("id") not "application_id"
  function baseFd(overrides: Record<string, string> = {}): FormData {
    const fd = new FormData();
    fd.set("id", "app-1");
    fd.set("campaign_id", "camp-1");
    for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
    return fd;
  }

  it("requires creator role", async () => {
    vi.mocked(requireRole).mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(withdrawApplication(baseFd())).rejects.toThrow("Unauthorized");
  });

  it("redirects with error on update failure", async () => {
    // update().eq().eq() — use makeMutationChain
    vi.mocked(mockSb.supabase.from).mockImplementationOnce(() =>
      makeMutationChain({ message: "fail", code: "50000" })
    );
    try {
      await withdrawApplication(baseFd());
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
    }
  });

  it("redirects with saved=1 on success", async () => {
    vi.mocked(mockSb.supabase.from).mockImplementationOnce(() =>
      makeMutationChain(null)
    );
    try {
      await withdrawApplication(baseFd());
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("saved=1");
    }
  });
});

// ─── decideApplication ────────────────────────────────────────────────────────

describe("decideApplication", () => {
  beforeEach(() => {
    vi.mocked(requireRole).mockResolvedValue({ user: { id: "u1" }, role: "brand" });
  });

  // Note: source uses formData.get("id") not "application_id"
  function baseFd(overrides: Record<string, string> = {}): FormData {
    const fd = new FormData();
    fd.set("id", "app-1");
    fd.set("campaign_id", "camp-1");
    fd.set("decision", "accepted");
    fd.set("decline_reason", "");
    for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
    return fd;
  }

  it("requires brand role", async () => {
    vi.mocked(requireRole).mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(decideApplication(baseFd())).rejects.toThrow("Unauthorized");
  });

  it("redirects without error for invalid decision", async () => {
    const fd = baseFd({ decision: "maybe" });
    let thrown = false;
    try {
      await decideApplication(fd);
      throw new Error("Expected redirect but none thrown");
    } catch (e: any) {
      thrown = true;
      expect(e.url).not.toContain("error=");
    }
    expect(thrown).toBe(true);
  });

  it("calls accept_campaign_application RPC on accepted and redirects to deal", async () => {
    mockSb.mockRpc("accept_campaign_application", { data: "deal-1", error: null });
    // post-RPC: query campaign_applications for creator_id (maybeSingle)
    mockSb.mockResult("campaign_applications", "maybeSingle", {
      data: { creator_id: "c1" },
      error: null,
    });
    const fd = baseFd({ decision: "accepted" });
    try {
      await decideApplication(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      // acceptRedirect("", "deal-1") → /deals/deal-1
      expect(e.url).toContain("deal");
    }
  });

  it("redirects with error when accept RPC fails", async () => {
    mockSb.mockRpc("accept_campaign_application", {
      data: null,
      error: { message: "RPC fail" },
    });
    const fd = baseFd({ decision: "accepted" });
    try {
      await decideApplication(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
    }
  });

  it("updates with decline_reason on declined and emails creator", async () => {
    // update().eq().select("creator_id").maybeSingle() — terminal is maybeSingle
    vi.mocked(mockSb.supabase.from).mockImplementationOnce(() =>
      makeMutationChainWithMaybeSingle(null, { creator_id: "c1" })
    );
    const fd = baseFd({ decision: "declined", decline_reason: "Not a fit" });
    let thrown = false;
    try {
      await decideApplication(fd);
      throw new Error("Expected redirect but none thrown");
    } catch (e: any) {
      thrown = true;
      expect(e.url).not.toContain("error=");
    }
    expect(thrown).toBe(true);
    expect(vi.mocked(emailUser)).toHaveBeenCalled();
  });

  it("stores null when decline_reason is empty", async () => {
    vi.mocked(mockSb.supabase.from).mockImplementationOnce(() =>
      makeMutationChainWithMaybeSingle(null, { creator_id: "c1" })
    );
    const fd = baseFd({ decision: "declined", decline_reason: "" });
    // Should succeed without error (null stored as declineReason)
    let thrown = false;
    try {
      await decideApplication(fd);
      throw new Error("Expected redirect but none thrown");
    } catch (e: any) {
      thrown = true;
      expect(e.url).not.toContain("error=");
    }
    expect(thrown).toBe(true);
  });

  it("caps decline_reason at 500 chars (no error)", async () => {
    vi.mocked(mockSb.supabase.from).mockImplementationOnce(() =>
      makeMutationChainWithMaybeSingle(null, { creator_id: "c1" })
    );
    const fd = baseFd({ decision: "declined", decline_reason: "R".repeat(600) });
    // 600 chars → sliced to 500 → stored, no error
    let thrown = false;
    try {
      await decideApplication(fd);
      throw new Error("Expected redirect but none thrown");
    } catch (e: any) {
      thrown = true;
      expect(e.url).not.toContain("error=");
    }
    expect(thrown).toBe(true);
  });
});

// ─── bulkDecideApplications ───────────────────────────────────────────────────

describe("bulkDecideApplications", () => {
  beforeEach(() => {
    vi.mocked(requireRole).mockResolvedValue({ user: { id: "u1" }, role: "brand" });
  });

  // Note: source uses formData.getAll("application_ids") (not "ids" CSV)
  function baseFd(overrides: Record<string, string | string[]> = {}): FormData {
    const fd = new FormData();
    fd.set("campaign_id", "camp-1");
    fd.append("application_ids", "app-1");
    fd.append("application_ids", "app-2");
    fd.set("decision", "accepted");
    fd.set("decline_reason", "");
    for (const [k, v] of Object.entries(overrides)) {
      if (Array.isArray(v)) {
        // Replace any existing values
        fd.delete(k);
        for (const item of v) fd.append(k, item);
      } else {
        fd.set(k, v);
      }
    }
    return fd;
  }

  it("redirects without error for empty ids", async () => {
    const fd = new FormData();
    fd.set("campaign_id", "camp-1");
    fd.set("decision", "accepted");
    fd.set("decline_reason", "");
    // no application_ids appended → getAll returns []
    let thrown = false;
    try {
      await bulkDecideApplications(fd);
      throw new Error("Expected redirect but none thrown");
    } catch (e: any) {
      thrown = true;
      expect(e.url).not.toContain("error=");
    }
    expect(thrown).toBe(true);
  });

  it("redirects without error for invalid decision", async () => {
    const fd = baseFd();
    fd.set("decision", "invalid");
    let thrown = false;
    try {
      await bulkDecideApplications(fd);
      throw new Error("Expected redirect but none thrown");
    } catch (e: any) {
      thrown = true;
      expect(e.url).not.toContain("error=");
    }
    expect(thrown).toBe(true);
  });

  it("calls RPC per-id for accepted and emails on success", async () => {
    // Two ids → two RPC calls → two maybeSingle queries for creator_id
    mockSb.mockRpc("accept_campaign_application", { data: "deal-1", error: null });
    mockSb.mockRpc("accept_campaign_application", { data: "deal-2", error: null });
    mockSb.mockResult("campaign_applications", "maybeSingle", { data: { creator_id: "c1" }, error: null });
    const fd = baseFd();
    let thrown = false;
    try {
      await bulkDecideApplications(fd);
      throw new Error("Expected redirect but none thrown");
    } catch (e: any) {
      thrown = true;
      expect(e.url).not.toContain("error=");
    }
    expect(thrown).toBe(true);
  });

  it("collects errors and redirects with error count when RPC fails", async () => {
    // mockRpc uses a Map (last-write-wins for same name), so use mockResolvedValueOnce
    // for sequential same-name RPC calls.
    // First call: fail, second call: succeed
    vi.mocked(mockSb.supabase.rpc)
      .mockResolvedValueOnce({ data: null, error: { message: "RPC fail" } } as any)
      .mockResolvedValueOnce({ data: "deal-2", error: null } as any);
    // The second successful RPC will query campaign_applications for creator_id
    mockSb.mockResult("campaign_applications", "maybeSingle", {
      data: { creator_id: "c2" },
      error: null,
    });
    const fd = baseFd();
    try {
      await bulkDecideApplications(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
    }
  });

  it("updates per-id for declined with reason capped at 500 chars", async () => {
    // Two declined updates; each ends with .maybeSingle()
    vi.mocked(mockSb.supabase.from)
      .mockImplementationOnce(() =>
        makeMutationChainWithMaybeSingle(null, { creator_id: "c1" })
      )
      .mockImplementationOnce(() =>
        makeMutationChainWithMaybeSingle(null, { creator_id: "c2" })
      );
    const fd = baseFd({ decision: "declined", decline_reason: "R".repeat(600) });
    // 600 chars → sliced to 500; no error
    let thrown = false;
    try {
      await bulkDecideApplications(fd);
      throw new Error("Expected redirect but none thrown");
    } catch (e: any) {
      thrown = true;
      expect(e.url).not.toContain("error=");
    }
    expect(thrown).toBe(true);
  });
});
