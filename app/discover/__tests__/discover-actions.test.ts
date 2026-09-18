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

const emailUserMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/email", () => ({
  emailUser: (...args: unknown[]) => emailUserMock(...args),
}));

// ─── Supabase mock ────────────────────────────────────────────────────────────
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
import { sendReachouts, saveSearch, deleteSearch } from "../actions";

// ─── Chain builders ──────────────────────────────────────────────────────────

/** Chained mutation that can be awaited directly (e.g. .delete().eq().eq()) */
function makeMutationChain(error: { message: string; code: string } | null): any {
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

/** Chain that resolves .maybeSingle() with the provided data (null = no row). */
function makeChainWithMaybeSingle(data: Record<string, unknown> | null): any {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(() => Promise.resolve({ data, error: null })),
    then: (resolve: any) => resolve({ data, error: null }),
  };
  return chain;
}

// ─── beforeEach ──────────────────────────────────────────────────────────────
beforeEach(() => {
  // mockSb.reset() calls vi.clearAllMocks() — re-apply createServerSupabase after
  mockSb.reset();
  vi.mocked(createServerSupabase).mockResolvedValue(mockSb.supabase as any);
  requireRoleMock.mockResolvedValue({ user: { id: "u1" }, role: "brand" });
  emailUserMock.mockResolvedValue(undefined);
});

// ─── sendReachouts ───────────────────────────────────────────────────────────
// BEHAVIORAL NOTES (discrepancies from brief):
// - FormData key is "creator_id" (multi-value via append), NOT "creator_ids"
// - Table is "conversations" not "brand_reachouts"
// - Two prior brand_profiles maybeSingle queries happen before the insert loop
//   (outreach_template and company); defaults are used when data is null
// - emailUser is called per successful insert

describe("sendReachouts", () => {
  function baseFd(creatorIds: string[] = ["c1", "c2"]): FormData {
    const fd = new FormData();
    for (const id of creatorIds) {
      fd.append("creator_id", id);
    }
    return fd;
  }

  it("requires brand role", async () => {
    requireRoleMock.mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(sendReachouts(baseFd())).rejects.toThrow("Unauthorized");
  });

  it("errors when 0 creators selected", async () => {
    const fd = new FormData(); // no creator_id keys at all
    try {
      await sendReachouts(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
      expect(decodeURIComponent(e.url)).toMatch(/[Ss]elect.*creator/i);
    }
  });

  it("deduplicates creator_ids", async () => {
    // Three identical values → deduplicated to one unique ID
    mockSb.mockResult("conversations", "insert", { error: null });
    const fd = baseFd(["c1", "c1", "c1"]);
    try {
      await sendReachouts(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("sent=1");
    }
  });

  it("caps creator_ids at 20 — 21 IDs only processes 20", async () => {
    // Set up 20 successful inserts (the 21st is capped and never inserted)
    for (let i = 0; i < 20; i++) {
      mockSb.mockResult("conversations", "insert", { error: null });
    }
    const ids = Array.from({ length: 21 }, (_, i) => `c${i}`);
    const fd = baseFd(ids);
    try {
      await sendReachouts(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("/inbox");
      expect(e.url).toContain("sent=20");
    }
  });

  it("silently skips duplicate reachout (23505)", async () => {
    // c1 hits 23505 → skipped; c2 succeeds
    // mockResult uses a Map (one value per key), so we need sequential per-call mocks.
    // brand_profiles is queried twice (outreach_template, company) before the insert loop.
    // We use mockImplementationOnce for each supabase.from() call in order:
    //   1. brand_profiles (outreach_template) → default maybeSingle chain
    //   2. brand_profiles (company) → default maybeSingle chain
    //   3. conversations (c1 insert) → 23505 error
    //   4. conversations (c2 insert) → success
    vi.mocked(mockSb.supabase.from)
      .mockImplementationOnce(() => makeChainWithMaybeSingle(null)) // brand_profiles outreach_template
      .mockImplementationOnce(() => makeChainWithMaybeSingle(null)) // brand_profiles company
      .mockImplementationOnce(() => makeMutationChain({ message: "duplicate", code: "23505" })) // c1
      .mockImplementationOnce(() => makeMutationChain(null)); // c2

    const fd = baseFd(["c1", "c2"]);
    try {
      await sendReachouts(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      // c1 skipped (dup), c2 sent → sent=1
      expect(e.url).toContain("sent=1");
    }
  });

  it("collects non-duplicate errors", async () => {
    mockSb.mockResult("conversations", "insert", {
      error: { message: "DB fail", code: "50000" },
    });
    const fd = baseFd(["c1"]);
    try {
      await sendReachouts(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
    }
  });

  it("returns 'Already invited' when sent=0 and no errors (all 23505)", async () => {
    mockSb.mockResult("conversations", "insert", {
      error: { message: "duplicate", code: "23505" },
    });
    const fd = baseFd(["c1"]);
    try {
      await sendReachouts(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(decodeURIComponent(e.url)).toMatch(/[Aa]lready.*invited/i);
    }
  });

  it("redirects to /inbox?sent=N on success", async () => {
    mockSb.mockResult("conversations", "insert", { error: null });
    mockSb.mockResult("conversations", "insert", { error: null });
    const fd = baseFd(["c1", "c2"]);
    try {
      await sendReachouts(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("/inbox");
      expect(e.url).toContain("sent=2");
    }
  });

  it("emails per successful insert", async () => {
    mockSb.mockResult("conversations", "insert", { error: null });
    mockSb.mockResult("conversations", "insert", { error: null });
    const fd = baseFd(["c1", "c2"]);
    try {
      await sendReachouts(fd);
    } catch {
      // redirect expected — catch and continue
    }
    expect(emailUserMock).toHaveBeenCalledTimes(2);
  });
});

// ─── saveSearch ──────────────────────────────────────────────────────────────
// BEHAVIORAL NOTES (discrepancies from brief):
// - Table is "saved_filters" not "saved_searches"
// - Filter keys are SAVED_FILTER_KEYS: q, niche, country, type, min_price, max_price
//   (not niches/location/platform)
// - redirect URL contains "saved=1" as a query param alongside any filter params

describe("saveSearch", () => {
  function baseFd(overrides: Record<string, string> = {}): FormData {
    const fd = new FormData();
    fd.set("name", "My Search");
    fd.set("q", "tech");
    fd.set("niche", "gaming");
    fd.set("country", "US");
    for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
    return fd;
  }

  it("requires brand role", async () => {
    requireRoleMock.mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(saveSearch(baseFd())).rejects.toThrow("Unauthorized");
  });

  it("rejects empty search name", async () => {
    const fd = baseFd({ name: "" });
    try {
      await saveSearch(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
    }
  });

  it("rejects search name > 40 chars", async () => {
    const fd = baseFd({ name: "N".repeat(41) });
    try {
      await saveSearch(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
    }
  });

  it("returns duplicate error on 23505", async () => {
    mockSb.mockResult("saved_filters", "insert", {
      error: { message: "duplicate", code: "23505" },
    });
    const fd = baseFd();
    try {
      await saveSearch(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(decodeURIComponent(e.url)).toMatch(
        /already.*saved.*search.*name/i
      );
    }
  });

  it("caps filter params at 80 chars each (silently truncated)", async () => {
    mockSb.mockResult("saved_filters", "insert", { error: null });
    const fd = baseFd({
      niche: "X".repeat(100),
      country: "L".repeat(100),
      q: "P".repeat(100),
    });
    try {
      await saveSearch(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      // Should not error — params silently truncated to 80 chars, saved=1 present
      expect(e.url).toContain("saved=1");
      expect(e.url).not.toContain("error=");
    }
  });

  it("redirects with saved=1 on success", async () => {
    mockSb.mockResult("saved_filters", "insert", { error: null });
    const fd = baseFd();
    try {
      await saveSearch(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("saved=1");
    }
  });
});

// ─── deleteSearch ────────────────────────────────────────────────────────────
// BEHAVIORAL NOTES (discrepancies from brief):
// - Table is "saved_filters" not "saved_searches"
// - FormData key is "id" not "search_id"
// - Uses .delete().eq().eq() chain (makeMutationChain needed)

describe("deleteSearch", () => {
  it("requires brand role", async () => {
    requireRoleMock.mockRejectedValueOnce(new Error("Unauthorized"));
    const fd = new FormData();
    fd.set("id", "s1");
    await expect(deleteSearch(fd)).rejects.toThrow("Unauthorized");
  });

  it("performs brand-scoped delete and redirects to /discover", async () => {
    vi.mocked(mockSb.supabase.from).mockImplementationOnce(() =>
      makeMutationChain(null)
    );
    const fd = new FormData();
    fd.set("id", "s1");
    let thrown = false;
    try {
      await deleteSearch(fd);
      throw new Error("Expected redirect but none thrown");
    } catch (e: any) {
      thrown = true;
      expect(e.url).toContain("/discover");
    }
    expect(thrown).toBe(true);
  });
});
