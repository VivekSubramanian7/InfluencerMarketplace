// BEHAVIORAL NOTES (source vs brief discrepancies):
// - inviteToCampaign: FormData key is "creator_id" (plural via getAll), NOT "creator_ids" CSV
// - RPC name is "invite_to_campaign" (not "invite_creator_to_campaign")
// - "cap=invites" redirect requires error.code === "P0001" AND message contains
//   "invite limit reached" — because friendlyDbError only passes message through for P0001
// - Success path queries brand_profiles, campaigns, and creator_profiles after the RPC loop
// - sendTelegramMessage from @/lib/notifications/telegram must be mocked (fire-and-forget)

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks (hoisted by Vitest) ────────────────────────────────────────────────

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
vi.mock("@/lib/notifications/telegram", () => ({
  sendTelegramMessage: vi.fn(),
}));

import { createMockSupabase } from "@/app/__tests__/helpers/mock-supabase";
const mockSb = createMockSupabase();
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: vi.fn(() => Promise.resolve(mockSb.supabase)),
}));

vi.mock("@/lib/auth/require", () => ({
  requireRole: vi.fn().mockResolvedValue({ user: { id: "u1" }, role: "brand" }),
  requireUser: vi.fn().mockResolvedValue({ user: { id: "u1" }, role: "brand" }),
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { redirect } from "next/navigation";
import { emailUser } from "@/lib/email";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { trackServerEvent } from "@/lib/analytics";
import { inviteToCampaign } from "../[id]/invite-actions";

// ─── Chain builders ───────────────────────────────────────────────────────────

/**
 * Resolves .maybeSingle() with provided data.
 * Used for brand_profiles, campaigns post-loop queries.
 */
function makeMaybeSingleChain(data: unknown, error: unknown = null): Record<string, unknown> {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "neq", "not", "in", "order", "limit"]) {
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
  vi.mocked(requireRole).mockResolvedValue({ user: { id: "u1" }, role: "brand" } as any);
});

// ─── inviteToCampaign ─────────────────────────────────────────────────────────

describe("inviteToCampaign", () => {
  /**
   * Build a FormData using getAll-compatible append (creator_id key, not creator_ids).
   */
  function baseFd(creatorIds: string[] = ["c1", "c2"], overrides: Record<string, string> = {}): FormData {
    const fd = new FormData();
    fd.set("campaign_id", "camp-1");
    for (const id of creatorIds) fd.append("creator_id", id);
    for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
    return fd;
  }

  /**
   * Set up mock chains for the post-RPC-loop queries that run on success:
   * 1. brand_profiles → maybeSingle
   * 2. campaigns → maybeSingle
   * 3. creator_profiles → array result via .then (uses .in())
   */
  function setupSuccessPostLoopMocks() {
    vi.mocked(mockSb.supabase.from)
      // brand_profiles
      .mockImplementationOnce(() =>
        makeMaybeSingleChain({ company: "Acme Brand" })
      )
      // campaigns
      .mockImplementationOnce(() =>
        makeMaybeSingleChain({ title: "Test Campaign" })
      )
      // creator_profiles (.select().in() → array)
      .mockImplementationOnce(() => {
        const chain: Record<string, unknown> = {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          then: (resolve: (v: unknown) => unknown) =>
            Promise.resolve({ data: [{ user_id: "c1", handle: "creator1" }], error: null }).then(resolve),
        };
        return chain;
      });
  }

  it("requires brand role", async () => {
    vi.mocked(requireRole).mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(inviteToCampaign(baseFd())).rejects.toThrow("Unauthorized");
  });

  it("errors when campaign_id is missing", async () => {
    const fd = baseFd(["c1"]);
    fd.set("campaign_id", ""); // override to empty
    try {
      await inviteToCampaign(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(decodeURIComponent(e.url)).toMatch(/Select a campaign/i);
    }
  });

  it("errors when creator_ids is empty", async () => {
    const fd = baseFd([]); // no creator_id appended
    try {
      await inviteToCampaign(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(decodeURIComponent(e.url)).toMatch(/[Ss]elect.*creator/i);
    }
  });

  it("caps creator_ids at 5 — 6 IDs only processes 5", async () => {
    // 6 unique IDs → sliced to 5; set up post-loop queries
    // brand_profiles is queried first (before the RPC loop)
    vi.mocked(mockSb.supabase.from)
      // brand_profiles (before the loop)
      .mockImplementationOnce(() =>
        makeMaybeSingleChain({ company: "Acme" })
      );

    // 5 RPC calls (6th is silently dropped)
    vi.mocked(mockSb.supabase.rpc)
      .mockResolvedValueOnce({ data: "conv-1", error: null } as any)
      .mockResolvedValueOnce({ data: "conv-2", error: null } as any)
      .mockResolvedValueOnce({ data: "conv-3", error: null } as any)
      .mockResolvedValueOnce({ data: "conv-4", error: null } as any)
      .mockResolvedValueOnce({ data: "conv-5", error: null } as any);

    // emailUser called 5 times → already mocked as resolved
    vi.mocked(emailUser).mockResolvedValue(undefined);

    // Post-loop: campaigns + creator_profiles
    vi.mocked(mockSb.supabase.from)
      .mockImplementationOnce(() =>
        makeMaybeSingleChain({ title: "Camp" })
      )
      .mockImplementationOnce(() => {
        const chain: Record<string, unknown> = {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          then: (resolve: (v: unknown) => unknown) =>
            Promise.resolve({ data: [], error: null }).then(resolve),
        };
        return chain;
      });

    const fd = baseFd(["c1", "c2", "c3", "c4", "c5", "c6"]);
    let thrown = false;
    try {
      await inviteToCampaign(fd);
      throw new Error("no redirect");
    } catch (e: any) {
      thrown = true;
      expect(e.url).not.toContain("error=");
    }
    expect(thrown).toBe(true);
    // Only 5 RPC calls (not 6)
    expect(vi.mocked(mockSb.supabase.rpc)).toHaveBeenCalledTimes(5);
  });

  it("deduplicates creator_ids", async () => {
    // 3x the same id → deduplicated to 1 unique → 1 RPC call
    vi.mocked(mockSb.supabase.from)
      .mockImplementationOnce(() =>
        makeMaybeSingleChain({ company: "Brand X" })
      );

    vi.mocked(mockSb.supabase.rpc)
      .mockResolvedValueOnce({ data: "conv-1", error: null } as any);

    vi.mocked(emailUser).mockResolvedValue(undefined);

    vi.mocked(mockSb.supabase.from)
      .mockImplementationOnce(() =>
        makeMaybeSingleChain({ title: "Camp" })
      )
      .mockImplementationOnce(() => {
        const chain: Record<string, unknown> = {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          then: (resolve: (v: unknown) => unknown) =>
            Promise.resolve({ data: [{ user_id: "c1", handle: "alice" }], error: null }).then(resolve),
        };
        return chain;
      });

    const fd = baseFd(["c1", "c1", "c1"]);
    let thrown = false;
    try {
      await inviteToCampaign(fd);
      throw new Error("no redirect");
    } catch (e: any) {
      thrown = true;
      expect(e.url).not.toContain("error=");
    }
    expect(thrown).toBe(true);
    // Only 1 RPC call (deduplicated from 3)
    expect(vi.mocked(mockSb.supabase.rpc)).toHaveBeenCalledTimes(1);
  });

  it("redirects with cap=invites when all fail with invite limit (P0001)", async () => {
    // friendlyDbError only passes message through for code === "P0001"
    // Without P0001, message becomes GENERIC and won't include "invite limit reached"
    vi.mocked(mockSb.supabase.from)
      .mockImplementationOnce(() =>
        makeMaybeSingleChain({ company: "Brand" })
      );

    vi.mocked(mockSb.supabase.rpc)
      .mockResolvedValueOnce({
        data: null,
        error: { code: "P0001", message: "invite limit reached" },
      } as any);

    const fd = baseFd(["c1"]);
    try {
      await inviteToCampaign(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("cap=invites");
    }
  });

  it("redirects with error= when all fail with non-limit error", async () => {
    vi.mocked(mockSb.supabase.from)
      .mockImplementationOnce(() =>
        makeMaybeSingleChain({ company: "Brand" })
      );

    vi.mocked(mockSb.supabase.rpc)
      .mockResolvedValueOnce({
        data: null,
        error: { code: "50000", message: "Some other RPC error" },
      } as any);

    const fd = baseFd(["c1"]);
    try {
      await inviteToCampaign(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("error=");
    }
  });

  it("tracks event, emails, and redirects on success (single creator → /inbox?c=)", async () => {
    vi.mocked(mockSb.supabase.from)
      .mockImplementationOnce(() =>
        makeMaybeSingleChain({ company: "Acme" })
      );

    vi.mocked(mockSb.supabase.rpc)
      .mockResolvedValueOnce({ data: "conv-abc", error: null } as any);

    vi.mocked(emailUser).mockResolvedValue(undefined);

    vi.mocked(mockSb.supabase.from)
      .mockImplementationOnce(() =>
        makeMaybeSingleChain({ title: "My Campaign" })
      )
      .mockImplementationOnce(() => {
        const chain: Record<string, unknown> = {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          then: (resolve: (v: unknown) => unknown) =>
            Promise.resolve({ data: [{ user_id: "c1", handle: "alice" }], error: null }).then(resolve),
        };
        return chain;
      });

    const fd = baseFd(["c1"]);
    try {
      await inviteToCampaign(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      // Single invite → /inbox?c=<convId>
      expect(e.url).toContain("inbox");
      expect(e.url).toContain("conv-abc");
      expect(e.url).not.toContain("error=");
    }
    expect(vi.mocked(trackServerEvent)).toHaveBeenCalled();
    expect(vi.mocked(emailUser)).toHaveBeenCalled();
  });

  it("redirects to /inbox?sent=N for multiple successful invites", async () => {
    vi.mocked(mockSb.supabase.from)
      .mockImplementationOnce(() =>
        makeMaybeSingleChain({ company: "Brand" })
      );

    vi.mocked(mockSb.supabase.rpc)
      .mockResolvedValueOnce({ data: "conv-1", error: null } as any)
      .mockResolvedValueOnce({ data: "conv-2", error: null } as any);

    vi.mocked(emailUser).mockResolvedValue(undefined);

    vi.mocked(mockSb.supabase.from)
      .mockImplementationOnce(() =>
        makeMaybeSingleChain({ title: "Campaign" })
      )
      .mockImplementationOnce(() => {
        const chain: Record<string, unknown> = {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          then: (resolve: (v: unknown) => unknown) =>
            Promise.resolve({
              data: [
                { user_id: "c1", handle: "alice" },
                { user_id: "c2", handle: "bob" },
              ],
              error: null,
            }).then(resolve),
        };
        return chain;
      });

    const fd = baseFd(["c1", "c2"]);
    try {
      await inviteToCampaign(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      // Multiple invites → /inbox?sent=2
      expect(e.url).toContain("sent=2");
      expect(e.url).not.toContain("error=");
    }
  });

  it("uses redirect_to base when provided on error", async () => {
    vi.mocked(mockSb.supabase.from)
      .mockImplementationOnce(() =>
        makeMaybeSingleChain({ company: "Brand" })
      );

    vi.mocked(mockSb.supabase.rpc)
      .mockResolvedValueOnce({
        data: null,
        error: { code: "50000", message: "fail" },
      } as any);

    const fd = baseFd(["c1"]);
    fd.set("redirect_to", "/campaigns/camp-1");

    try {
      await inviteToCampaign(fd);
      expect.unreachable("should redirect");
    } catch (e: any) {
      expect(e.url).toContain("/campaigns/camp-1");
      expect(e.url).toContain("error=");
    }
  });
});
