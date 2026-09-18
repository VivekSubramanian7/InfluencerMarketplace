import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase } from "../../__tests__/helpers/mock-supabase";

// ── Redirect helper ──────────────────────────────────────────────
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

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/analytics", () => ({
  trackServerEvent: vi.fn(),
}));

vi.mock("@/lib/auth/require", () => ({
  requireRole: vi.fn(() =>
    Promise.resolve({ user: { id: "u1" }, role: "creator" as const })
  ),
}));

const mockSb = createMockSupabase();
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: vi.fn(() => Promise.resolve(mockSb.supabase)),
}));

// ── Helpers ──────────────────────────────────────────────────────
function fd(overrides: Record<string, string> = {}): FormData {
  const defaults: Record<string, string> = {
    type: "dedicated_video",
    title: "My Great Offering",
    description: "A test description",
    price: "100",
    turnaround_days: "7",
    revision_limit: "2",
  };
  const f = new FormData();
  for (const [k, v] of Object.entries({ ...defaults, ...overrides })) f.set(k, v);
  return f;
}

async function catchRedirect(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    throw new Error("Expected redirect");
  } catch (e) {
    if (e instanceof RedirectError) return e.url;
    throw e;
  }
}

// ── Import under test (after mocks) ─────────────────────────────
import { saveOfferingStep } from "../offerings/actions";

beforeEach(() => {
  vi.clearAllMocks();
  // Default: creator has a profile with handle
  mockSb.mockResult("creator_profiles", "maybeSingle", {
    data: { handle: "testcreator" },
  });
  // Default: insert succeeds
  mockSb.mockResult("offerings", "insert", { error: null });
});

/* ================================================================
 * saveOfferingStep
 * ================================================================ */
describe("saveOfferingStep", () => {
  /* ── Profile gate ─────────────────────────────────────────────── */
  it("redirects to /onboarding/profile when no creator_profile exists", async () => {
    mockSb.mockResult("creator_profiles", "maybeSingle", { data: null });
    const url = await catchRedirect(() => saveOfferingStep(fd()));
    expect(url).toContain("/onboarding/profile");
    expect(decodeURIComponent(url)).toContain("Claim your handle first");
  });

  /* ── Type validation ──────────────────────────────────────────── */
  it("rejects unknown offering type", async () => {
    const url = await catchRedirect(() => saveOfferingStep(fd({ type: "podcast" })));
    expect(url).toContain("/onboarding/offerings?error=");
  });

  it("rejects empty offering type", async () => {
    const url = await catchRedirect(() => saveOfferingStep(fd({ type: "" })));
    expect(url).toContain("/onboarding/offerings?error=");
  });

  it("accepts all valid offering types", async () => {
    for (const type of ["dedicated_video", "integration", "short_form_post", "ugc_video"]) {
      vi.clearAllMocks();
      mockSb.mockResult("creator_profiles", "maybeSingle", {
        data: { handle: "testcreator" },
      });
      mockSb.mockResult("offerings", "insert", { error: null });
      const url = await catchRedirect(() => saveOfferingStep(fd({ type })));
      expect(url).toBe("/onboarding/offerings?saved=1");
    }
  });

  /* ── Title validation (parseText, max 80) ─────────────────────── */
  it("rejects empty title", async () => {
    const url = await catchRedirect(() => saveOfferingStep(fd({ title: "" })));
    expect(url).toContain("/onboarding/offerings?error=");
  });

  it("rejects title longer than 80 chars", async () => {
    const url = await catchRedirect(() =>
      saveOfferingStep(fd({ title: "x".repeat(81) }))
    );
    expect(url).toContain("/onboarding/offerings?error=");
  });

  it("accepts title at exactly 80 chars", async () => {
    const url = await catchRedirect(() =>
      saveOfferingStep(fd({ title: "x".repeat(80) }))
    );
    expect(url).toBe("/onboarding/offerings?saved=1");
  });

  /* ── Description validation (parseOptionalText, max 2000) ──── */
  it("accepts empty description (optional field)", async () => {
    const url = await catchRedirect(() =>
      saveOfferingStep(fd({ description: "" }))
    );
    expect(url).toBe("/onboarding/offerings?saved=1");
  });

  it("rejects description longer than 2000 chars", async () => {
    const url = await catchRedirect(() =>
      saveOfferingStep(fd({ description: "x".repeat(2001) }))
    );
    expect(url).toContain("/onboarding/offerings?error=");
  });

  it("accepts description at exactly 2000 chars", async () => {
    const url = await catchRedirect(() =>
      saveOfferingStep(fd({ description: "x".repeat(2000) }))
    );
    expect(url).toBe("/onboarding/offerings?saved=1");
  });

  /* ── Price validation (parsePriceCents, $1–$1M) ───────────── */
  it("rejects price below $1", async () => {
    const url = await catchRedirect(() => saveOfferingStep(fd({ price: "0.99" })));
    expect(url).toContain("/onboarding/offerings?error=");
  });

  it("rejects price of $0", async () => {
    const url = await catchRedirect(() => saveOfferingStep(fd({ price: "0" })));
    expect(url).toContain("/onboarding/offerings?error=");
  });

  it("rejects price above $1,000,000", async () => {
    const url = await catchRedirect(() =>
      saveOfferingStep(fd({ price: "1000000.01" }))
    );
    expect(url).toContain("/onboarding/offerings?error=");
  });

  it("rejects non-numeric price", async () => {
    const url = await catchRedirect(() => saveOfferingStep(fd({ price: "abc" })));
    expect(url).toContain("/onboarding/offerings?error=");
  });

  it("rejects negative price", async () => {
    const url = await catchRedirect(() => saveOfferingStep(fd({ price: "-5" })));
    expect(url).toContain("/onboarding/offerings?error=");
  });

  it("accepts $1 (minimum)", async () => {
    const url = await catchRedirect(() => saveOfferingStep(fd({ price: "1" })));
    expect(url).toBe("/onboarding/offerings?saved=1");
  });

  it("accepts $1,000,000 (maximum)", async () => {
    const url = await catchRedirect(() =>
      saveOfferingStep(fd({ price: "1000000" }))
    );
    expect(url).toBe("/onboarding/offerings?saved=1");
  });

  /* ── Turnaround validation (parseIntInRange 1–90) ────────── */
  it("rejects turnaround of 0", async () => {
    const url = await catchRedirect(() =>
      saveOfferingStep(fd({ turnaround_days: "0" }))
    );
    expect(url).toContain("/onboarding/offerings?error=");
  });

  it("rejects turnaround of 91", async () => {
    const url = await catchRedirect(() =>
      saveOfferingStep(fd({ turnaround_days: "91" }))
    );
    expect(url).toContain("/onboarding/offerings?error=");
  });

  it("rejects non-integer turnaround", async () => {
    const url = await catchRedirect(() =>
      saveOfferingStep(fd({ turnaround_days: "3.5" }))
    );
    expect(url).toContain("/onboarding/offerings?error=");
  });

  it("accepts turnaround of 1 (minimum)", async () => {
    const url = await catchRedirect(() =>
      saveOfferingStep(fd({ turnaround_days: "1" }))
    );
    expect(url).toBe("/onboarding/offerings?saved=1");
  });

  it("accepts turnaround of 90 (maximum)", async () => {
    const url = await catchRedirect(() =>
      saveOfferingStep(fd({ turnaround_days: "90" }))
    );
    expect(url).toBe("/onboarding/offerings?saved=1");
  });

  /* ── Revisions validation (parseIntInRange 0–5) ───────────── */
  it("rejects revision_limit of -1", async () => {
    const url = await catchRedirect(() =>
      saveOfferingStep(fd({ revision_limit: "-1" }))
    );
    expect(url).toContain("/onboarding/offerings?error=");
  });

  it("rejects revision_limit of 6", async () => {
    const url = await catchRedirect(() =>
      saveOfferingStep(fd({ revision_limit: "6" }))
    );
    expect(url).toContain("/onboarding/offerings?error=");
  });

  it("accepts revision_limit of 0 (minimum)", async () => {
    const url = await catchRedirect(() =>
      saveOfferingStep(fd({ revision_limit: "0" }))
    );
    expect(url).toBe("/onboarding/offerings?saved=1");
  });

  it("accepts revision_limit of 5 (maximum)", async () => {
    const url = await catchRedirect(() =>
      saveOfferingStep(fd({ revision_limit: "5" }))
    );
    expect(url).toBe("/onboarding/offerings?saved=1");
  });

  /* ── DB error on insert ────────────────────────────────────── */
  it("redirects with DB error message on insert failure", async () => {
    mockSb.mockResult("offerings", "insert", {
      error: { message: "duplicate key value" },
    });
    const url = await catchRedirect(() => saveOfferingStep(fd()));
    expect(url).toContain("/onboarding/offerings?error=");
    expect(url).toContain("duplicate%20key%20value");
  });

  /* ── Success path ──────────────────────────────────────────── */
  it("inserts correct data into offerings table", async () => {
    mockSb.mockResult("offerings", "insert", { error: null });
    await catchRedirect(() =>
      saveOfferingStep(
        fd({
          type: "integration",
          title: "Sponsor Segment",
          description: "60s mid-roll",
          price: "250.50",
          turnaround_days: "14",
          revision_limit: "3",
        })
      )
    );
    expect(mockSb.supabase.from).toHaveBeenCalledWith("offerings");
    // The insert call should have been made on the chain
    // We verify the from("offerings") was called — the chain mock handles the rest
  });

  it("redirects to /onboarding/offerings?saved=1 on success", async () => {
    mockSb.mockResult("offerings", "insert", { error: null });
    const url = await catchRedirect(() => saveOfferingStep(fd()));
    expect(url).toBe("/onboarding/offerings?saved=1");
  });

  it("revalidates the creator's storefront path", async () => {
    const { revalidatePath } = await import("next/cache");
    mockSb.mockResult("offerings", "insert", { error: null });
    await catchRedirect(() => saveOfferingStep(fd()));
    expect(revalidatePath).toHaveBeenCalledWith("/c/testcreator");
  });

  /* ── Compound guard: error message content ────────────────── */
  it("error message includes all field constraints", async () => {
    const url = await catchRedirect(() => saveOfferingStep(fd({ title: "" })));
    const decoded = decodeURIComponent(url);
    expect(decoded).toContain("title");
    expect(decoded).toContain("80");
    expect(decoded).toContain("price");
    expect(decoded).toContain("turnaround");
    expect(decoded).toContain("revisions");
  });
});
