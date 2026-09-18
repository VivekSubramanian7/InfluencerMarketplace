import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase } from "@/app/__tests__/helpers/mock-supabase";

// ─── Redirect helper ─────────────────────────────────────────────────────────

class RedirectError extends Error {
  url: string;
  constructor(url: string) {
    super("REDIRECT");
    this.url = url;
  }
}

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new RedirectError(url);
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

// ─── Supabase mock ────────────────────────────────────────────────────────────
// createMockSupabase() is called here (module scope) before vi.mock factories
// execute, so the factory closure over mockSb is satisfied at import time.
const mockSb = createMockSupabase();
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: vi.fn(() => Promise.resolve(mockSb.supabase)),
}));

// ─── Auth mock ────────────────────────────────────────────────────────────────
const requireRoleMock = vi.fn().mockResolvedValue({
  user: { id: "u1" },
  role: "brand",
});
vi.mock("@/lib/auth/require", () => ({
  requireRole: (...args: unknown[]) => requireRoleMock(...args),
  requireUser: vi.fn().mockResolvedValue({ user: { id: "u1" }, role: "brand" }),
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────
import { createServerSupabase } from "@/lib/supabase/server";
import {
  createCampaign,
  setCampaignStatus,
  editCampaign,
} from "../actions";

// ─── Chain builders for queries that end in a chaining method ────────────────
// The default mock chain's select/eq/etc. return the chain itself, which is
// not thenable. For queries that are awaited directly (no .single()/.maybeSingle()),
// or where update().eq().eq() escapes the thenable wrapper, provide one-shot
// thenable chains.
function makeCountChain(count: number): any {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    then: (resolve: any) => resolve({ data: null, error: null, count }),
  };
}

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

// ─── beforeEach ──────────────────────────────────────────────────────────────

beforeEach(() => {
  // mockSb.reset() calls vi.clearAllMocks() — re-apply createServerSupabase after
  mockSb.reset();
  vi.mocked(createServerSupabase).mockResolvedValue(mockSb.supabase as any);
  requireRoleMock.mockResolvedValue({ user: { id: "u1" }, role: "brand" });
});

// ─── createCampaign ──────────────────────────────────────────────────────────
// BEHAVIORAL NOTES (discrepancies from brief):
// - Offering types are: dedicated_video, integration, short_form_post, ugc_video
//   (not "ugc" or "barter")
// - Barter is controlled by is_barter=on FormData field, not the type field
// - Duration field name is "duration_seconds" (not "duration")
// - Budget values are parsed via parsePriceCents: "500" → 50000 cents (valid)
// - insert().select("id").single() uses "single" as terminal key for mockResult

describe("createCampaign", () => {
  function baseFd(overrides: Record<string, string> = {}): FormData {
    const fd = new FormData();
    fd.set("title", "Summer Campaign");
    fd.set("description", "A great campaign for summer");
    fd.set("type", "ugc_video");
    fd.set("budget_min", "500");
    fd.set("budget_max", "1000");
    fd.set("buyer_persona", "");
    fd.set("target_location", "");
    fd.set("target_language", "");
    fd.set("content_form", "");
    fd.set("script", "");
    fd.set("duration_seconds", "");
    for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
    return fd;
  }

  it("requires brand role", async () => {
    requireRoleMock.mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(createCampaign(baseFd())).rejects.toThrow("Unauthorized");
  });

  it("rejects empty title", async () => {
    const fd = baseFd({ title: "" });
    try {
      await createCampaign(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
    }
  });

  it("rejects title > 80 chars", async () => {
    const fd = baseFd({ title: "T".repeat(81) });
    try {
      await createCampaign(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
    }
  });

  it("rejects empty description", async () => {
    const fd = baseFd({ description: "" });
    try {
      await createCampaign(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
    }
  });

  it("rejects description > 2000 chars", async () => {
    const fd = baseFd({ description: "D".repeat(2001) });
    try {
      await createCampaign(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
    }
  });

  it("rejects invalid offering type", async () => {
    const fd = baseFd({ type: "not_a_real_type" });
    try {
      await createCampaign(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
    }
  });

  it("rejects non-barter campaign with missing budget_min", async () => {
    const fd = baseFd({ budget_min: "", budget_max: "1000" });
    try {
      await createCampaign(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
    }
  });

  it("rejects non-barter campaign with missing budget_max", async () => {
    const fd = baseFd({ budget_min: "500", budget_max: "" });
    try {
      await createCampaign(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
    }
  });

  it("rejects non-barter campaign with budget_max < budget_min", async () => {
    // parsePriceCents("1000") = 100000 cents, parsePriceCents("500") = 50000 cents
    // budgetMax(50000) < budgetMin(100000) → validation fails
    const fd = baseFd({ budget_min: "1000", budget_max: "500" });
    try {
      await createCampaign(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
    }
  });

  it("allows barter campaigns with zero budget and no budget validation", async () => {
    // Barter is signalled via is_barter=on (not type=barter); budgets are forced to 0
    mockSb.mockResult("campaigns", "single", {
      data: { id: "camp-1" },
      error: null,
    });
    const fd = baseFd({
      is_barter: "on",
      budget_min: "",
      budget_max: "",
    });
    try {
      await createCampaign(fd);
    } catch (e: any) {
      expect(e.url).not.toContain("error=");
      expect(e.url).toContain("/campaigns/");
    }
  });

  it("rejects buyer_persona > 1000 chars", async () => {
    const fd = baseFd({ buyer_persona: "B".repeat(1001) });
    try {
      await createCampaign(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
    }
  });

  it("rejects target_location > 200 chars", async () => {
    const fd = baseFd({ target_location: "L".repeat(201) });
    try {
      await createCampaign(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
    }
  });

  it("rejects target_language > 100 chars", async () => {
    const fd = baseFd({ target_language: "L".repeat(101) });
    try {
      await createCampaign(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
    }
  });

  it("rejects content_form > 100 chars", async () => {
    const fd = baseFd({ content_form: "C".repeat(101) });
    try {
      await createCampaign(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
    }
  });

  it("rejects script > 5000 chars", async () => {
    const fd = baseFd({ script: "S".repeat(5001) });
    try {
      await createCampaign(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
    }
  });

  it("rejects invalid duration (out of 1-86400)", async () => {
    // Field name is duration_seconds (not "duration")
    const fd = baseFd({ duration_seconds: "0" });
    try {
      await createCampaign(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
    }
  });

  it("maps DB error 42501 via friendlyDbError", async () => {
    // insert().select("id").single() — terminal is "single"
    mockSb.mockResult("campaigns", "single", {
      error: { message: "permission denied", code: "42501" },
    });
    const fd = baseFd();
    try {
      await createCampaign(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
    }
  });

  it("redirects to /campaigns/{id} on success", async () => {
    // insert().select("id").single() — terminal is "single"
    mockSb.mockResult("campaigns", "single", {
      data: { id: "camp-new" },
      error: null,
    });
    const fd = baseFd();
    try {
      await createCampaign(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("/campaigns/camp-new");
    }
  });
});

// ─── setCampaignStatus ───────────────────────────────────────────────────────
// BEHAVIORAL NOTES (discrepancies from brief):
// - FormData field is "id" (not "campaign_id")

describe("setCampaignStatus", () => {
  function baseFd(overrides: Record<string, string> = {}): FormData {
    const fd = new FormData();
    fd.set("id", "camp-1");
    fd.set("status", "open");
    for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
    return fd;
  }

  it("requires brand role", async () => {
    requireRoleMock.mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(setCampaignStatus(baseFd())).rejects.toThrow("Unauthorized");
  });

  it("redirects without error for invalid status", async () => {
    const fd = baseFd({ status: "deleted" });
    try {
      await setCampaignStatus(fd);
    } catch (e: any) {
      expect(e.url).not.toContain("error=");
    }
  });

  it("redirects with error on DB failure", async () => {
    // update().eq().eq() escapes the default thenable wrapper after first .eq()
    // Use mockImplementationOnce with a fully-thenable mutation chain instead
    vi.mocked(mockSb.supabase.from).mockImplementationOnce(() =>
      makeMutationChain({ message: "DB fail", code: "50000" })
    );
    const fd = baseFd({ status: "open" });
    try {
      await setCampaignStatus(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
    }
  });

  it("redirects with saved=1 on success", async () => {
    vi.mocked(mockSb.supabase.from).mockImplementationOnce(() =>
      makeMutationChain(null)
    );
    const fd = baseFd({ status: "closed" });
    try {
      await setCampaignStatus(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("saved=1");
    }
  });
});

// ─── editCampaign ────────────────────────────────────────────────────────────
// BEHAVIORAL NOTES (discrepancies from brief):
// - FormData field is "id" (not "campaign_id")
// - editCampaign fetches current campaign from DB via .single() to detect changes,
//   rather than using "current_budget_min" etc. form fields
// - Pending-app check: select("id", {count:"exact",head:true}).eq().eq() ends in
//   a chaining method — requires makeCountChain via vi.mocked(mockSb.supabase.from)

describe("editCampaign", () => {
  function baseFd(overrides: Record<string, string> = {}): FormData {
    const fd = new FormData();
    fd.set("id", "camp-1");
    fd.set("title", "Updated Campaign");
    fd.set("description", "Updated description");
    fd.set("type", "ugc_video");
    fd.set("budget_min", "500");
    fd.set("budget_max", "1000");
    fd.set("buyer_persona", "");
    fd.set("target_location", "");
    fd.set("target_language", "");
    fd.set("content_form", "");
    fd.set("script", "");
    fd.set("duration_seconds", "");
    for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
    return fd;
  }

  it("rejects empty title", async () => {
    const fd = baseFd({ title: "" });
    try {
      await editCampaign(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
    }
  });

  it("rejects empty description", async () => {
    const fd = baseFd({ description: "" });
    try {
      await editCampaign(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
    }
  });

  it("blocks budget change when pending applications exist", async () => {
    // editCampaign fetches current campaign first (.single()), then if budget/type
    // changed, checks pending apps via a chained select (no terminal method).
    // We mock: first from("campaigns") → .single() returns old budget,
    //          second from("campaign_applications") → makeCountChain(3)
    mockSb.mockResult("campaigns", "single", {
      data: {
        budget_min_cents: 50000,  // $500 = 50000 cents
        budget_max_cents: 100000, // $1000 = 100000 cents
        offering_type: "ugc_video",
      },
      error: null,
    });
    vi.mocked(mockSb.supabase.from)
      .mockImplementationOnce((_table: string) => {
        // first call: campaigns → use the default chain (which has .single() mocked)
        return (createMockSupabaseChainWithSingle(
          { budget_min_cents: 50000, budget_max_cents: 100000, offering_type: "ugc_video" }
        ));
      })
      .mockImplementationOnce((_table: string) => makeCountChain(3));

    // budget_min changes: "800" → 80000 cents, current is 50000 → changed
    const fd = baseFd({ budget_min: "800" });
    try {
      await editCampaign(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
      expect(decodeURIComponent(e.url)).toMatch(
        /[Cc]annot.*change.*budget|offering.*pending/i
      );
    }
  });

  it("blocks offering type change when pending applications exist", async () => {
    vi.mocked(mockSb.supabase.from)
      .mockImplementationOnce((_table: string) =>
        createMockSupabaseChainWithSingle({
          budget_min_cents: 50000,
          budget_max_cents: 100000,
          offering_type: "ugc_video",
        })
      )
      .mockImplementationOnce((_table: string) => makeCountChain(1));

    // type changes: short_form_post ≠ ugc_video → changed
    const fd = baseFd({ type: "short_form_post" });
    try {
      await editCampaign(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
      expect(decodeURIComponent(e.url)).toMatch(
        /[Cc]annot.*change.*budget|offering.*pending/i
      );
    }
  });

  it("allows edit when budget/type unchanged despite pending apps", async () => {
    // No change to budget or type → no pending-app check → goes straight to update
    // budget_min=500 → 50000 cents == current 50000, budget_max=1000 → 100000 == current 100000
    mockSb.mockResult("campaigns", "single", {
      data: {
        budget_min_cents: 50000,
        budget_max_cents: 100000,
        offering_type: "ugc_video",
      },
      error: null,
    });
    mockSb.mockResult("campaigns", "update", { error: null });
    const fd = baseFd(); // all values unchanged from "current"
    try {
      await editCampaign(fd);
    } catch (e: any) {
      expect(e.url).not.toContain("error=");
    }
  });

  it("returns friendlyDbError on update failure", async () => {
    // editCampaign makes two from("campaigns") calls:
    //   1. select(...).eq(...).eq(...).single() — fetch current campaign
    //   2. update(...).eq(...).eq(...)           — perform update
    // Use mockImplementationOnce for each call in order.
    vi.mocked(mockSb.supabase.from)
      .mockImplementationOnce(() =>
        createMockSupabaseChainWithSingle({
          budget_min_cents: 50000,
          budget_max_cents: 100000,
          offering_type: "ugc_video",
        })
      )
      .mockImplementationOnce(() =>
        makeMutationChain({ message: "fail", code: "50000" })
      );
    const fd = baseFd();
    try {
      await editCampaign(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
    }
  });

  it("redirects on success", async () => {
    mockSb.mockResult("campaigns", "single", {
      data: {
        budget_min_cents: 50000,
        budget_max_cents: 100000,
        offering_type: "ugc_video",
      },
      error: null,
    });
    mockSb.mockResult("campaigns", "update", { error: null });
    const fd = baseFd();
    try {
      await editCampaign(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).not.toContain("error=");
    }
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a minimal chainable mock that resolves .single() with the provided data.
 * Used when we need to override supabase.from() for the campaigns table in editCampaign.
 */
function createMockSupabaseChainWithSingle(data: Record<string, any>): any {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(() => Promise.resolve({ data, error: null })),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    then: (resolve: any) => resolve({ data, error: null }),
  };
  return chain;
}
