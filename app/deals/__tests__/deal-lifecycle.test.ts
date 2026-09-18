import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase } from "@/app/__tests__/helpers/mock-supabase";

// ─── Redirect helper ──────────────────────────────────────────────────────────

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

// ─── Supabase mock ────────────────────────────────────────────────────────────
// createMockSupabase() is called here (module scope) before vi.mock factories
// execute, so the factory closure over mockSb is satisfied at import time.
const mockSb = createMockSupabase();
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: vi.fn(() => Promise.resolve(mockSb.supabase)),
}));

// ─── Auth mock ────────────────────────────────────────────────────────────────
const requireUserMock = vi.fn().mockResolvedValue({
  user: { id: "u1" },
  role: "brand",
});
vi.mock("@/lib/auth/require", () => ({
  requireUser: (...args: unknown[]) => requireUserMock(...args),
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────
import { createServerSupabase } from "@/lib/supabase/server";
import { performDealAction, markPaid } from "../[id]/actions";

// ─── FormData helper ──────────────────────────────────────────────────────────
function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

// ─── Redirect catcher ─────────────────────────────────────────────────────────
async function catchRedirect(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    throw new Error("Expected redirect");
  } catch (e: any) {
    if (e.url !== undefined) return e.url;
    throw e;
  }
}

// ─── beforeEach ───────────────────────────────────────────────────────────────
beforeEach(() => {
  // mockSb.reset() calls vi.clearAllMocks() — re-apply createServerSupabase after
  mockSb.reset();
  vi.mocked(createServerSupabase).mockResolvedValue(mockSb.supabase as any);
  requireUserMock.mockResolvedValue({ user: { id: "u1" }, role: "brand" });
});

/* ================================================================
   performDealAction
   ================================================================ */
describe("performDealAction", () => {
  it("rejects unknown action", async () => {
    const url = await catchRedirect(() =>
      performDealAction(fd({ deal_id: "d1", action: "fly_to_moon" }))
    );
    expect(decodeURIComponent(url)).toContain("Unknown action");
  });

  it("rejects when role is neither brand nor creator", async () => {
    requireUserMock.mockResolvedValue({ user: { id: "u1" }, role: "admin" });

    const url = await catchRedirect(() =>
      performDealAction(fd({ deal_id: "d1", action: "accept" }))
    );
    expect(decodeURIComponent(url)).toContain("Unknown action");
  });

  it("requires valid URL for submit_preview", async () => {
    requireUserMock.mockResolvedValue({ user: { id: "u1" }, role: "creator" });

    const url = await catchRedirect(() =>
      performDealAction(
        fd({ deal_id: "d1", action: "submit_preview", url: "not-a-url" })
      )
    );
    expect(decodeURIComponent(url)).toContain("valid http(s) link");
  });

  it("requires valid URL for mark_published", async () => {
    requireUserMock.mockResolvedValue({ user: { id: "u1" }, role: "creator" });

    const url = await catchRedirect(() =>
      performDealAction(
        fd({ deal_id: "d1", action: "mark_published", url: "" })
      )
    );
    expect(decodeURIComponent(url)).toContain("valid http(s) link");
  });

  it("requires note text for request_revision", async () => {
    const url = await catchRedirect(() =>
      performDealAction(
        fd({ deal_id: "d1", action: "request_revision", note: "" })
      )
    );
    expect(decodeURIComponent(url)).toContain("Say what to change");
  });

  it("passes coupon_code in payload for mark_product_sent", async () => {
    mockSb.mockRpc("transition_deal", {
      data: {
        creator_id: "cr1",
        brand_id: "u1",
        offering_title: "TikTok vid",
        payment_mode: "barter",
      },
      error: null,
    });

    const url = await catchRedirect(() =>
      performDealAction(
        fd({
          deal_id: "d1",
          action: "mark_product_sent",
          coupon_code: "FREE20",
        })
      )
    );
    expect(url).toContain("/deals/d1");
  });

  it("calls transition_deal RPC and redirects on success", async () => {
    mockSb.mockRpc("transition_deal", {
      data: {
        creator_id: "cr1",
        brand_id: "u1",
        offering_title: "TikTok vid",
      },
      error: null,
    });

    const url = await catchRedirect(() =>
      performDealAction(fd({ deal_id: "d1", action: "approve" }))
    );
    expect(url).toContain("/deals/d1");

    const { emailUser } = await import("@/lib/email");
    expect(emailUser).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "cr1" })
    );
  });

  it("redirects with friendlyDbError when RPC fails", async () => {
    mockSb.mockRpc("transition_deal", {
      data: null,
      error: { code: "P0001", message: "Invalid transition" },
    });

    const url = await catchRedirect(() =>
      performDealAction(fd({ deal_id: "d1", action: "accept" }))
    );
    expect(decodeURIComponent(url)).toContain("Invalid transition");
  });

  it("submit_preview with valid URL calls RPC", async () => {
    requireUserMock.mockResolvedValue({ user: { id: "u1" }, role: "creator" });
    mockSb.mockRpc("transition_deal", {
      data: {
        creator_id: "u1",
        brand_id: "b1",
        offering_title: "YouTube vid",
      },
      error: null,
    });

    const url = await catchRedirect(() =>
      performDealAction(
        fd({
          deal_id: "d1",
          action: "submit_preview",
          url: "https://example.com/preview",
        })
      )
    );
    expect(url).toContain("/deals/d1");
  });
});

/* ================================================================
   markPaid
   ================================================================ */
describe("markPaid", () => {
  it("calls mark_deal_paid RPC and redirects", async () => {
    mockSb.mockRpc("mark_deal_paid", { data: null, error: null });

    const url = await catchRedirect(() => markPaid(fd({ deal_id: "d1" })));
    expect(url).toContain("/deals/d1");
  });

  it("redirects with friendlyDbError on RPC failure", async () => {
    mockSb.mockRpc("mark_deal_paid", {
      data: null,
      error: { code: "P0001", message: "Not authorized" },
    });

    const url = await catchRedirect(() => markPaid(fd({ deal_id: "d1" })));
    expect(decodeURIComponent(url)).toContain("Not authorized");
  });
});
