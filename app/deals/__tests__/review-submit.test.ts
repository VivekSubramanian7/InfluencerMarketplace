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

const requireUserMock = vi.fn().mockResolvedValue({
  user: { id: "u1" },
  role: "brand",
});
vi.mock("@/lib/auth/require", () => ({
  requireUser: (...a: unknown[]) => requireUserMock(...a),
}));

const reviewRevalidatePathMock = vi.fn().mockReturnValue("/c/jane");
vi.mock("../[id]/review-target", () => ({
  reviewRevalidatePath: (...a: unknown[]) => reviewRevalidatePathMock(...a),
}));

import { createServerSupabase } from "@/lib/supabase/server";
import { submitReview } from "../[id]/review-actions";

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
  requireUserMock.mockResolvedValue({ user: { id: "u1" }, role: "brand" });
});

describe("submitReview", () => {
  it("rejects missing rating", async () => {
    const url = await catchRedirect(() =>
      submitReview(fd({ deal_id: "d1", rating: "" }))
    );
    expect(decodeURIComponent(url)).toContain("Pick a rating from 1 to 5");
  });

  it("rejects rating of 0 (below range)", async () => {
    const url = await catchRedirect(() =>
      submitReview(fd({ deal_id: "d1", rating: "0" }))
    );
    expect(decodeURIComponent(url)).toContain("Pick a rating from 1 to 5");
  });

  it("rejects rating of 6 (above range)", async () => {
    const url = await catchRedirect(() =>
      submitReview(fd({ deal_id: "d1", rating: "6" }))
    );
    expect(decodeURIComponent(url)).toContain("Pick a rating from 1 to 5");
  });

  it("rejects non-numeric rating", async () => {
    const url = await catchRedirect(() =>
      submitReview(fd({ deal_id: "d1", rating: "abc" }))
    );
    expect(decodeURIComponent(url)).toContain("Pick a rating from 1 to 5");
  });

  it("rejects body over 1000 chars", async () => {
    const url = await catchRedirect(() =>
      submitReview(
        fd({ deal_id: "d1", rating: "3", body: "x".repeat(1001) })
      )
    );
    expect(decodeURIComponent(url)).toContain("Review is too long");
  });

  it("allows empty body (optional)", async () => {
    mockSb.mockResult("reviews", "insert", { error: null });
    mockSb.mockResult("deals", "maybeSingle", {
      data: { brand_id: "u1", creator_id: "cr1" },
      error: null,
    });
    mockSb.mockResult("creator_profiles", "maybeSingle", {
      data: { handle: "jane" },
      error: null,
    });

    const url = await catchRedirect(() =>
      submitReview(fd({ deal_id: "d1", rating: "4", body: "" }))
    );
    expect(url).toContain("/deals/d1");
  });

  it("maps error 23505 to duplicate review message", async () => {
    mockSb.mockResult("reviews", "insert", {
      error: { code: "23505", message: "dup" },
    });

    const url = await catchRedirect(() =>
      submitReview(fd({ deal_id: "d1", rating: "3" }))
    );
    expect(decodeURIComponent(url)).toContain("You already reviewed this deal");
  });

  it("maps error 42501 to permission message", async () => {
    mockSb.mockResult("reviews", "insert", {
      error: { code: "42501", message: "rls" },
    });

    const url = await catchRedirect(() =>
      submitReview(fd({ deal_id: "d1", rating: "3" }))
    );
    expect(decodeURIComponent(url)).toContain(
      "You can only review completed deals you were part of"
    );
  });

  it("revalidates creator profile path when brand is author", async () => {
    mockSb.mockResult("reviews", "insert", { error: null });
    mockSb.mockResult("deals", "maybeSingle", {
      data: { brand_id: "u1", creator_id: "cr1" },
      error: null,
    });
    mockSb.mockResult("creator_profiles", "maybeSingle", {
      data: { handle: "jane" },
      error: null,
    });

    await catchRedirect(() =>
      submitReview(fd({ deal_id: "d1", rating: "5" }))
    );

    expect(reviewRevalidatePathMock).toHaveBeenCalledWith("creator", "jane");
  });

  it("revalidates brand profile path when creator is author", async () => {
    requireUserMock.mockResolvedValue({ user: { id: "cr1" }, role: "creator" });
    mockSb.mockResult("reviews", "insert", { error: null });
    mockSb.mockResult("deals", "maybeSingle", {
      data: { brand_id: "b1", creator_id: "cr1" },
      error: null,
    });
    mockSb.mockResult("brand_profiles", "maybeSingle", {
      data: { slug: "acme" },
      error: null,
    });

    await catchRedirect(() =>
      submitReview(fd({ deal_id: "d1", rating: "5" }))
    );

    expect(reviewRevalidatePathMock).toHaveBeenCalledWith("brand", "acme");
  });

  it("accepts valid rating of 3 with body", async () => {
    mockSb.mockResult("reviews", "insert", { error: null });
    mockSb.mockResult("deals", "maybeSingle", {
      data: { brand_id: "u1", creator_id: "cr1" },
      error: null,
    });
    mockSb.mockResult("creator_profiles", "maybeSingle", {
      data: { handle: "jane" },
      error: null,
    });

    const url = await catchRedirect(() =>
      submitReview(fd({ deal_id: "d1", rating: "3", body: "Good work" }))
    );
    expect(url).toContain("/deals/d1");
  });
});
