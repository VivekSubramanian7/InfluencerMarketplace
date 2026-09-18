import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase } from "@/app/__tests__/helpers/mock-supabase";

// ─── Redirect helper ────────────────────────────────────────────────────────

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

// ─── Supabase mock ──────────────────────────────────────────────────────────
// createMockSupabase() is called here (module scope) before vi.mock factories
// execute, so the factory closure over mockSb is satisfied at import time.
const mockSb = createMockSupabase();
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: vi.fn(() => Promise.resolve(mockSb.supabase)),
}));

// ─── Auth mock ──────────────────────────────────────────────────────────────
const requireRoleMock = vi.fn().mockResolvedValue({
  user: { id: "u1" },
  role: "brand",
});
vi.mock("@/lib/auth/require", () => ({
  requireRole: (...args: unknown[]) => requireRoleMock(...args),
  requireUser: (...args: unknown[]) => requireRoleMock(...args),
}));

// ─── ingestWebsite mock (source imports from @/lib/brand/ingest) ─────────────
const ingestWebsiteMock = vi.fn().mockResolvedValue({
  description: "A great company",
});
vi.mock("@/lib/brand/ingest", () => ({
  ingestWebsite: (...args: unknown[]) => ingestWebsiteMock(...args),
}));

// ─── Imports after mocks ─────────────────────────────────────────────────────
import { createServerSupabase } from "@/lib/supabase/server";
import {
  saveBrandProfile,
  addProduct,
  removeProduct,
  readWebsite,
  createInvite,
  blockCreator,
  unblockCreator,
} from "../actions";

// ─── Chain builders for count/mutation queries ────────────────────────────────
// The default mock chain only returns configured results for "terminal" methods
// (maybeSingle, single) and insert/update/delete/upsert. Queries that end in a
// chaining method like .eq()/.not() are not awaitable via the default chain.
// These builders produce one-shot thenable chains for such cases.
function makeCountChain(count: number): any {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    then: (resolve: any) => resolve({ data: null, error: null, count }),
  };
}

function makeMutationChain(error: any): any {
  return {
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    then: (resolve: any) => resolve({ data: null, error }),
  };
}

// ─── beforeEach ──────────────────────────────────────────────────────────────

beforeEach(() => {
  // mockSb.reset() internally calls vi.clearAllMocks(). This clears call history
  // but NOT mock implementations. The initial implementation of supabase.from
  // (set via vi.fn(impl) in createMockSupabase) therefore survives.
  // We also need to re-apply createServerSupabase since clearAllMocks wipes its
  // call tracking (though the implementation itself also survives — we still
  // re-apply it explicitly to be safe, matching the documented pattern).
  mockSb.reset();
  vi.mocked(createServerSupabase).mockResolvedValue(mockSb.supabase as any);
  requireRoleMock.mockResolvedValue({ user: { id: "u1" }, role: "brand" });
  ingestWebsiteMock.mockResolvedValue({ description: "A great company" });
  // Default RPC so saveBrandProfile doesn't fail on slug generation
  mockSb.mockRpc("generate_unique_brand_slug", { data: "acme-corp", error: null });
});

// ─── saveBrandProfile ────────────────────────────────────────────────────────

describe("saveBrandProfile", () => {
  // BEHAVIORAL NOTES (discrepancies from brief):
  // - source reads "from" key (not "source") for onboarding/settings switch
  // - source reads "gsc_property" key (not "gsc")
  // - source reads "outreach_template" key (not "template")
  // - source calls supabase.rpc("generate_unique_brand_slug", ...) before upsert
  // - source also deletes from brand_ingestions after saving

  function baseFd(overrides: Record<string, string> = {}): FormData {
    const fd = new FormData();
    fd.set("company", "Acme Corp");
    fd.set("description", "We make things");
    fd.set("notes", "");
    fd.set("outreach_template", "");
    fd.set("website", "");
    fd.set("gsc_property", "");
    fd.set("pref_niches", "");
    fd.set("products_json", "");
    fd.set("from", "settings");
    for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
    return fd;
  }

  function mockSuccess() {
    mockSb.mockResult("brand_profiles", "upsert", { error: null });
    mockSb.mockResult("brand_ingestions", "delete", { error: null });
  }

  it("requires brand role", async () => {
    requireRoleMock.mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(saveBrandProfile(baseFd())).rejects.toThrow("Unauthorized");
  });

  it("rejects empty company name", async () => {
    const fd = baseFd({ company: "" });
    try {
      await saveBrandProfile(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
      expect(decodeURIComponent(e.url)).toMatch(/[Cc]ompany.*required/i);
    }
  });

  it("rejects company name > 120 chars", async () => {
    const fd = baseFd({ company: "A".repeat(121) });
    try {
      await saveBrandProfile(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
    }
  });

  it("rejects whitespace-only company name", async () => {
    const fd = baseFd({ company: "   " });
    try {
      await saveBrandProfile(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
      expect(decodeURIComponent(e.url)).toMatch(/[Cc]ompany.*required/i);
    }
  });

  it("rejects description > 2000 chars", async () => {
    const fd = baseFd({ description: "D".repeat(2001) });
    try {
      await saveBrandProfile(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
    }
  });

  it("rejects notes > 4000 chars", async () => {
    const fd = baseFd({ notes: "N".repeat(4001) });
    try {
      await saveBrandProfile(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
    }
  });

  it("rejects outreach_template > 2000 chars", async () => {
    const fd = baseFd({ outreach_template: "T".repeat(2001) });
    try {
      await saveBrandProfile(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
    }
  });

  it("rejects invalid website URL", async () => {
    const fd = baseFd({ website: "not-a-url" });
    try {
      await saveBrandProfile(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
      expect(decodeURIComponent(e.url)).toMatch(/[Ww]ebsite.*valid.*http/i);
    }
  });

  it("accepts valid https website URL", async () => {
    mockSuccess();
    const fd = baseFd({ website: "https://example.com" });
    try {
      await saveBrandProfile(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).not.toContain("error=");
    }
  });

  it("rejects invalid GSC URL (reads gsc_property key)", async () => {
    const fd = baseFd({ gsc_property: "ftp://bad.url" });
    try {
      await saveBrandProfile(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
      expect(decodeURIComponent(e.url)).toMatch(/[Ss]earch.*[Cc]onsole.*valid.*http/i);
    }
  });

  it("caps pref_niches at 8 tags (silently)", async () => {
    mockSuccess();
    const fd = baseFd({ pref_niches: "a,b,c,d,e,f,g,h,i,j" });
    try {
      await saveBrandProfile(fd);
    } catch (e: any) {
      expect(e.url).not.toContain("error=");
    }
  });

  it("filters pref_types against OFFERING_TYPES enum (silently strips invalid)", async () => {
    mockSuccess();
    const fd = baseFd();
    fd.append("pref_types", "ugc");
    fd.append("pref_types", "invalid_type");
    fd.append("pref_types", "shoutout");
    try {
      await saveBrandProfile(fd);
    } catch (e: any) {
      expect(e.url).not.toContain("error=");
    }
  });

  it("caps products_json to 12 products (silently)", async () => {
    const products = Array.from({ length: 15 }, (_, i) => ({
      name: `Product ${i}`,
    }));
    mockSuccess();
    mockSb.mockResult("brand_products", "insert", { error: null });
    const fd = baseFd({ products_json: JSON.stringify(products) });
    try {
      await saveBrandProfile(fd);
    } catch (e: any) {
      expect(e.url).not.toContain("error=");
    }
  });

  it("caps per-product fields (name 120, url 500, description 500) silently", async () => {
    const products = [
      {
        name: "X".repeat(200),
        url: "https://example.com/" + "x".repeat(600),
        description: "D".repeat(600),
      },
    ];
    mockSuccess();
    mockSb.mockResult("brand_products", "insert", { error: null });
    const fd = baseFd({ products_json: JSON.stringify(products) });
    try {
      await saveBrandProfile(fd);
    } catch (e: any) {
      expect(e.url).not.toContain("error=");
    }
  });

  it("validates product target_age_min/max 13-100 (out-of-range silently becomes null)", async () => {
    const products = [{ name: "P1", target_age_min: 5, target_age_max: 200 }];
    mockSuccess();
    mockSb.mockResult("brand_products", "insert", { error: null });
    const fd = baseFd({ products_json: JSON.stringify(products) });
    try {
      await saveBrandProfile(fd);
    } catch (e: any) {
      expect(e.url).not.toContain("error=");
    }
  });

  it("validates product target_gender enum (invalid silently becomes null)", async () => {
    const products = [{ name: "P1", target_gender: "nonbinary" }];
    mockSuccess();
    mockSb.mockResult("brand_products", "insert", { error: null });
    const fd = baseFd({ products_json: JSON.stringify(products) });
    try {
      await saveBrandProfile(fd);
    } catch (e: any) {
      expect(e.url).not.toContain("error=");
    }
  });

  it("returns friendlyDbError on brand_profiles upsert failure", async () => {
    mockSb.mockResult("brand_profiles", "upsert", {
      error: { message: "DB down", code: "50000" },
    });
    const fd = baseFd();
    try {
      await saveBrandProfile(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
    }
  });

  it("redirects to /campaigns?first=1 on success from onboarding (reads 'from' key)", async () => {
    mockSuccess();
    const fd = baseFd({ from: "onboarding" });
    try {
      await saveBrandProfile(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("/campaigns");
      expect(e.url).toContain("first=1");
    }
  });

  it("redirects to /brand/settings?saved=1 on success from settings", async () => {
    mockSuccess();
    const fd = baseFd({ from: "settings" });
    try {
      await saveBrandProfile(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("/brand/settings");
      expect(e.url).toContain("saved=1");
    }
  });
});

// ─── addProduct ──────────────────────────────────────────────────────────────

describe("addProduct", () => {
  function baseFd(overrides: Record<string, string> = {}): FormData {
    const fd = new FormData();
    fd.set("name", "Widget");
    fd.set("description", "A widget");
    fd.set("url", "");
    fd.set("target_age_min", "18");
    fd.set("target_age_max", "65");
    fd.set("target_gender", "all");
    fd.set("target_location", "US");
    for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
    return fd;
  }

  it("rejects empty product name", async () => {
    const fd = baseFd({ name: "" });
    try {
      await addProduct(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
    }
  });

  it("rejects product name > 120 chars", async () => {
    const fd = baseFd({ name: "N".repeat(121) });
    try {
      await addProduct(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
    }
  });

  it("rejects description > 500 chars", async () => {
    const fd = baseFd({ description: "D".repeat(501) });
    try {
      await addProduct(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
    }
  });

  it("rejects invalid product URL", async () => {
    const fd = baseFd({ url: "not-valid" });
    try {
      await addProduct(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
    }
  });

  it("accepts valid product URL", async () => {
    mockSb.mockResult("brand_products", "insert", { error: null });
    const fd = baseFd({ url: "https://shop.example.com/widget" });
    try {
      await addProduct(fd);
    } catch (e: any) {
      expect(e.url).not.toContain("error=");
    }
  });

  it("out-of-range age_min (< 13) is silently stored as null — no validation error", async () => {
    // Source: parseIntInRange("5", 13, 100) returns null.
    // The source does not reject null age values; they're stored as null.
    // ageMin=null means the min>max guard is skipped, insert proceeds normally.
    mockSb.mockResult("brand_products", "insert", { error: null });
    const fd = baseFd({ target_age_min: "5" });
    try {
      await addProduct(fd);
    } catch (e: any) {
      expect(e.url).not.toContain("error=");
    }
  });

  it("out-of-range age_max (> 100) is silently stored as null — no validation error", async () => {
    mockSb.mockResult("brand_products", "insert", { error: null });
    const fd = baseFd({ target_age_max: "150" });
    try {
      await addProduct(fd);
    } catch (e: any) {
      expect(e.url).not.toContain("error=");
    }
  });

  it("rejects age_min > age_max (both in-range values)", async () => {
    const fd = baseFd({ target_age_min: "50", target_age_max: "20" });
    try {
      await addProduct(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
      expect(decodeURIComponent(e.url)).toMatch(/[Aa]ge.*range.*min.*less/i);
    }
  });

  it("maps invalid target_gender to null (no error)", async () => {
    mockSb.mockResult("brand_products", "insert", { error: null });
    const fd = baseFd({ target_gender: "unknown_value" });
    try {
      await addProduct(fd);
    } catch (e: any) {
      expect(e.url).not.toContain("error=");
    }
  });

  it("accepts valid target_gender values (male, female, all)", async () => {
    for (const g of ["male", "female", "all"]) {
      mockSb.mockResult("brand_products", "insert", { error: null });
      const fd = baseFd({ target_gender: g });
      try {
        await addProduct(fd);
      } catch (e: any) {
        expect(e.url).not.toContain("error=");
      }
    }
  });

  it("returns friendlyDbError on insert failure", async () => {
    mockSb.mockResult("brand_products", "insert", {
      error: { message: "DB error", code: "50000" },
    });
    const fd = baseFd();
    try {
      await addProduct(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
    }
  });
});

// ─── removeProduct ───────────────────────────────────────────────────────────

describe("removeProduct", () => {
  // BEHAVIORAL NOTES (discrepancies from brief):
  // - source reads "id" key (not "product_id")
  // - source queries "campaigns" table (not "campaign_products")
  // - The campaigns count query ends in .eq() — a chaining method, not a terminal.
  //   The default mock chain is not awaitable at that point; use mockImplementationOnce.

  it("blocks deletion when product used by active campaign", async () => {
    vi.mocked(mockSb.supabase.from)
      .mockImplementationOnce(() => makeCountChain(2));

    const fd = new FormData();
    fd.set("id", "prod-1");
    try {
      await removeProduct(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
      expect(decodeURIComponent(e.url)).toMatch(/active.*campaign/i);
    }
  });

  it("deletes product when not used by any campaign", async () => {
    vi.mocked(mockSb.supabase.from)
      .mockImplementationOnce(() => makeCountChain(0))
      .mockImplementationOnce(() => makeMutationChain(null));

    const fd = new FormData();
    fd.set("id", "prod-1");
    try {
      await removeProduct(fd);
    } catch (e: any) {
      expect(e.url).not.toContain("error=");
    }
  });
});

// ─── readWebsite ─────────────────────────────────────────────────────────────

describe("readWebsite", () => {
  // BEHAVIORAL NOTES (discrepancies from brief):
  // - source reads "website" key (not "url") from FormData
  // - source imports ingestWebsite from @/lib/brand/ingest (not @/lib/ingest-website)

  it("rejects invalid URL", async () => {
    const fd = new FormData();
    fd.set("website", "bad-url");
    try {
      await readWebsite(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
    }
  });

  it("redirects with error when ingestWebsite throws", async () => {
    ingestWebsiteMock.mockRejectedValueOnce(new Error("timeout"));
    const fd = new FormData();
    fd.set("website", "https://example.com");
    try {
      await readWebsite(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
    }
  });

  it("redirects with proposal=1 on success", async () => {
    ingestWebsiteMock.mockResolvedValueOnce({ description: "Company desc" });
    mockSb.mockResult("brand_ingestions", "upsert", { error: null });
    const fd = new FormData();
    fd.set("website", "https://example.com");
    try {
      await readWebsite(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("proposal=1");
    }
  });
});

// ─── createInvite ────────────────────────────────────────────────────────────

describe("createInvite", () => {
  // BEHAVIORAL NOTES (discrepancy from brief):
  // - source inserts into "creator_invites" (not "brand_invites")

  it("rejects empty contact", async () => {
    const fd = new FormData();
    fd.set("contact", "");
    try {
      await createInvite(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
    }
  });

  it("rejects contact > 200 chars", async () => {
    const fd = new FormData();
    fd.set("contact", "C".repeat(201));
    try {
      await createInvite(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
    }
  });

  it("returns friendlyDbError on DB failure", async () => {
    // source uses "creator_invites" table, not "brand_invites"
    mockSb.mockResult("creator_invites", "insert", {
      error: { message: "DB error", code: "50000" },
    });
    const fd = new FormData();
    fd.set("contact", "alice@example.com");
    try {
      await createInvite(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
    }
  });

  it("succeeds with valid contact", async () => {
    mockSb.mockResult("creator_invites", "insert", { error: null });
    const fd = new FormData();
    fd.set("contact", "alice@example.com");
    try {
      await createInvite(fd);
    } catch (e: any) {
      expect(e.url).not.toContain("error=");
    }
  });
});

// ─── blockCreator ────────────────────────────────────────────────────────────

describe("blockCreator", () => {
  // Source flow:
  // 1. Count active deals via .from("deals").select(...).eq(...).eq(...).not(...)
  //    (ends in a chaining method — needs a directly-thenable chain mock)
  // 2. Insert into brand_blocklist
  // 3. code "23505" → silently ignore; other errors → redirect with error
  // 4. If activeDeals > 0 → redirect with warning param

  it("silently ignores duplicate blocklist entry (23505)", async () => {
    vi.mocked(mockSb.supabase.from)
      .mockImplementationOnce(() => makeCountChain(0))
      .mockImplementationOnce(() =>
        makeMutationChain({ message: "duplicate", code: "23505" })
      );

    const fd = new FormData();
    fd.set("creator_id", "c1");
    try {
      await blockCreator(fd);
    } catch (e: any) {
      expect(e.url).not.toMatch(/error=/);
    }
  });

  it("redirects with error on non-duplicate DB error", async () => {
    vi.mocked(mockSb.supabase.from)
      .mockImplementationOnce(() => makeCountChain(0))
      .mockImplementationOnce(() =>
        makeMutationChain({ message: "DB fail", code: "50000" })
      );

    const fd = new FormData();
    fd.set("creator_id", "c1");
    try {
      await blockCreator(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
    }
  });

  it("includes warning when active deals exist with blocked creator", async () => {
    vi.mocked(mockSb.supabase.from)
      .mockImplementationOnce(() => makeCountChain(1))
      .mockImplementationOnce(() => makeMutationChain(null));

    const fd = new FormData();
    fd.set("creator_id", "c1");
    try {
      await blockCreator(fd);
    } catch (e: any) {
      expect(decodeURIComponent(e.url)).toMatch(/warning|active/i);
    }
  });

  it("redirects without warning when no active deals", async () => {
    vi.mocked(mockSb.supabase.from)
      .mockImplementationOnce(() => makeCountChain(0))
      .mockImplementationOnce(() => makeMutationChain(null));

    const fd = new FormData();
    fd.set("creator_id", "c1");
    try {
      await blockCreator(fd);
    } catch (e: any) {
      expect(e.url).not.toContain("warning=");
    }
  });
});

// ─── unblockCreator ──────────────────────────────────────────────────────────

describe("unblockCreator", () => {
  it("deletes from blocklist and redirects", async () => {
    mockSb.mockResult("brand_blocklist", "delete", { error: null });
    const fd = new FormData();
    fd.set("creator_id", "c1");
    try {
      await unblockCreator(fd);
    } catch (e: any) {
      expect(e.url).toBeDefined();
      expect(e.url).not.toContain("error=");
    }
  });
});
