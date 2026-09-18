// app/inbox/__tests__/inbox-actions.test.ts
//
// BEHAVIORAL NOTES (source vs brief discrepancies):
// - respondInvite: update chain ends with .select("brand_id").maybeSingle() →
//   use mockResult("conversations", "maybeSingle", ...) not "update"
// - sendThreadMessage: agent_drafts delete is a bare .delete().eq() thenable →
//   defaultResult (error: null) handles success; mockResult("agent_drafts","delete")
//   covers error cases if needed (not currently tested)
// - respondOffer decline: .update().eq() thenable → use mockImplementationOnce
//   for sequential from() calls
// - draftReply: Promise.all with 3 queries. conversations first (maybeSingle),
//   then 3× mockImplementationOnce for [messages thread, messages recent, brand_profiles]
//   and one more for agent_drafts upsert. ALL from() calls must be accounted for
//   in sequence via mockImplementationOnce.
// - sendOffer: campaigns/conversations use .maybeSingle() → mockResult works
// - bulkArchiveConversations: loops over RPCs; single mockRpc covers all iterations

import { describe, it, expect, vi, beforeEach } from "vitest";

/* ── redirect / framework mocks ─────────────────────────────────────────────── */
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

/* ── supabase mock ───────────────────────────────────────────────────────────── */
import { createMockSupabase } from "@/app/__tests__/helpers/mock-supabase";
const mockSb = createMockSupabase();
// Use lazy factory so mockSb.supabase is accessed at call-time (after hoisting)
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: vi.fn(() => Promise.resolve(mockSb.supabase)),
}));

/* ── auth mocks (default: creator) ──────────────────────────────────────────── */
const requireRoleMock = vi.fn().mockResolvedValue({
  user: { id: "u1" },
  role: "creator",
});
const requireUserMock = vi.fn().mockResolvedValue({
  user: { id: "u1" },
  role: "creator",
});
vi.mock("@/lib/auth/require", () => ({
  requireRole: (...a: unknown[]) => requireRoleMock(...a),
  requireUser: (...a: unknown[]) => requireUserMock(...a),
}));

/* ── onboarding mocks ────────────────────────────────────────────────────────── */
const COMPLETE_STATE = {
  hasProfile: true,
  isLive: true,
  handle: "jane",
  socialCount: 1,
  offeringCount: 1,
  portfolioCount: 1,
};
const INCOMPLETE_STATE = {
  hasProfile: true,
  isLive: false,
  handle: "jane",
  socialCount: 0,
  offeringCount: 0,
  portfolioCount: 0,
};
const getOnboardingStateMock = vi.fn().mockResolvedValue(COMPLETE_STATE);
vi.mock("@/lib/onboarding/state", () => ({
  getOnboardingState: (...a: unknown[]) => getOnboardingStateMock(...a),
}));

/* ── budget mock ─────────────────────────────────────────────────────────────── */
vi.mock("@/lib/campaigns/budget", () => ({
  capOfferToCampaign: vi.fn((price: number, max: number | null) => {
    if (max != null && price > max) return { cents: max, capped: true };
    return { cents: price, capped: false };
  }),
}));

/* ── LLM mock ────────────────────────────────────────────────────────────────── */
const generatePlainTextMock = vi.fn().mockResolvedValue("Draft reply text");
vi.mock("@/lib/ai/llm", () => ({
  generatePlainText: (...a: unknown[]) => generatePlainTextMock(...a),
}));

/* ── SUT ─────────────────────────────────────────────────────────────────────── */
import { createServerSupabase } from "@/lib/supabase/server";
import {
  respondInvite,
  sendThreadMessage,
  sendOffer,
  respondOffer,
  draftReply,
  archiveConversation,
  unarchiveConversation,
  bulkArchiveConversations,
} from "../actions";

/* ── helpers ─────────────────────────────────────────────────────────────────── */
function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

/** Like fd() but supports multi-value keys (for bulkArchive). */
function fdMulti(entries: [string, string][]): FormData {
  const f = new FormData();
  for (const [k, v] of entries) f.append(k, v);
  return f;
}

async function catchRedirect(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    throw new Error("Expected redirect but none was thrown");
  } catch (e: any) {
    if (e.url !== undefined) return e.url;
    throw e;
  }
}

/**
 * Chainable mutation that can be awaited directly (e.g. .update().eq()).
 * Used for respondOffer decline (.update().eq()) and similar bare thenables.
 */
function makeMutationChain(error: { message: string; code: string } | null): any {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    then: (resolve: any) => resolve({ data: null, error }),
  };
  return chain;
}

/**
 * Chain with .maybeSingle() — for single-row selects.
 * Also thenable for direct-await patterns.
 */
function makeMaybeSingleChain(data: unknown, error: unknown = null): any {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(() => Promise.resolve({ data, error })),
    then: (resolve: any) => Promise.resolve({ data, error }).then(resolve),
  };
  return chain;
}

/**
 * Chain that resolves as a thenable array result.
 * Used for messages.select().eq().order().limit() in draftReply's Promise.all.
 */
function makeListChain(data: unknown[]): any {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: (resolve: any) => Promise.resolve({ data, error: null }).then(resolve),
  };
  return chain;
}

/* ── beforeEach ──────────────────────────────────────────────────────────────── */
beforeEach(() => {
  // reset() calls vi.clearAllMocks() — re-apply createServerSupabase after
  mockSb.reset();
  vi.mocked(createServerSupabase).mockResolvedValue(mockSb.supabase as any);
  requireRoleMock.mockResolvedValue({ user: { id: "u1" }, role: "creator" });
  requireUserMock.mockResolvedValue({ user: { id: "u1" }, role: "creator" });
  getOnboardingStateMock.mockResolvedValue(COMPLETE_STATE);
  generatePlainTextMock.mockResolvedValue("Draft reply text");
});

/* ================================================================
   respondInvite
   ================================================================ */
describe("respondInvite", () => {
  it("redirects to /inbox for invalid response values", async () => {
    const url = await catchRedirect(() =>
      respondInvite(fd({ conversation_id: "c1", response: "maybe" }))
    );
    expect(url).toBe("/inbox");
  });

  it("blocks accept when storefront is incomplete", async () => {
    getOnboardingStateMock.mockResolvedValue(INCOMPLETE_STATE);
    const url = await catchRedirect(() =>
      respondInvite(fd({ conversation_id: "c1", response: "accepted" }))
    );
    expect(url).toContain("error=");
    expect(decodeURIComponent(url)).toContain("Complete your storefront");
  });

  it("accepts invite, updates conversation, emails brand", async () => {
    // Source: .update().eq().eq().select("brand_id").maybeSingle()
    // All chaining methods return the same chain; maybeSingle is the terminal.
    mockSb.mockResult("conversations", "maybeSingle", {
      data: { brand_id: "b1" },
      error: null,
    });
    // profiles query: .select("display_name").eq("id", user.id).maybeSingle()
    mockSb.mockResult("profiles", "maybeSingle", {
      data: { display_name: "Jane" },
      error: null,
    });

    const url = await catchRedirect(() =>
      respondInvite(fd({ conversation_id: "c1", response: "accepted" }))
    );
    expect(url).toContain("/inbox/c1?focus=offer");

    const { emailUser } = await import("@/lib/email");
    expect(emailUser).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "b1" })
    );
  });

  it("declines invite and redirects to /inbox", async () => {
    mockSb.mockResult("conversations", "maybeSingle", {
      data: { brand_id: "b1" },
      error: null,
    });
    mockSb.mockResult("profiles", "maybeSingle", {
      data: { display_name: "Jane" },
      error: null,
    });

    const url = await catchRedirect(() =>
      respondInvite(fd({ conversation_id: "c1", response: "declined" }))
    );
    expect(url).toBe("/inbox");
  });

  it("shows friendlyDbError on update failure (P0001 passes message through)", async () => {
    mockSb.mockResult("conversations", "maybeSingle", {
      data: null,
      error: { code: "P0001", message: "Custom DB error" },
    });

    const url = await catchRedirect(() =>
      respondInvite(fd({ conversation_id: "c1", response: "accepted" }))
    );
    expect(decodeURIComponent(url)).toContain("Custom DB error");
  });

  it("shows 'Invitation not found' when update returns null data with no error", async () => {
    mockSb.mockResult("conversations", "maybeSingle", {
      data: null,
      error: null,
    });

    const url = await catchRedirect(() =>
      respondInvite(fd({ conversation_id: "c1", response: "accepted" }))
    );
    expect(decodeURIComponent(url)).toContain("Invitation not found");
  });
});

/* ================================================================
   sendThreadMessage
   ================================================================ */
describe("sendThreadMessage", () => {
  it("rejects empty body", async () => {
    const url = await catchRedirect(() =>
      sendThreadMessage(fd({ conversation_id: "c1", body: "" }))
    );
    expect(decodeURIComponent(url)).toContain("1-5000 characters");
  });

  it("rejects body over 5000 chars", async () => {
    const url = await catchRedirect(() =>
      sendThreadMessage(fd({ conversation_id: "c1", body: "x".repeat(5001) }))
    );
    expect(decodeURIComponent(url)).toContain("1-5000 characters");
  });

  it("maps error code 42501 to permission message", async () => {
    mockSb.mockResult("messages", "insert", {
      error: { code: "42501", message: "RLS" },
    });

    const url = await catchRedirect(() =>
      sendThreadMessage(fd({ conversation_id: "c1", body: "Hello" }))
    );
    expect(decodeURIComponent(url)).toContain(
      "You can only message in your own conversations"
    );
  });

  it("maps error code 23514 to not-open message", async () => {
    mockSb.mockResult("messages", "insert", {
      error: { code: "23514", message: "check" },
    });

    const url = await catchRedirect(() =>
      sendThreadMessage(fd({ conversation_id: "c1", body: "Hello" }))
    );
    expect(decodeURIComponent(url)).toContain(
      "This conversation isn't open for messages"
    );
  });

  it("succeeds: inserts message, deletes drafts, redirects to /inbox/c1", async () => {
    // messages.insert → thenable resolved by mockResult
    mockSb.mockResult("messages", "insert", { error: null });
    // agent_drafts.delete().eq() → bare thenable; defaultResult (error: null) suffices

    const url = await catchRedirect(() =>
      sendThreadMessage(fd({ conversation_id: "c1", body: "Hello" }))
    );
    expect(url).toBe("/inbox/c1");
  });

  it("respects return_to when it starts with /inbox", async () => {
    mockSb.mockResult("messages", "insert", { error: null });

    const url = await catchRedirect(() =>
      sendThreadMessage(
        fd({ conversation_id: "c1", body: "Hello", return_to: "/inbox?status=archived" })
      )
    );
    expect(url).toBe("/inbox?status=archived");
  });

  it("ignores return_to that does not start with /inbox", async () => {
    mockSb.mockResult("messages", "insert", { error: null });

    const url = await catchRedirect(() =>
      sendThreadMessage(
        fd({ conversation_id: "c1", body: "Hello", return_to: "/deals/123" })
      )
    );
    expect(url).toBe("/inbox/c1");
  });
});

/* ================================================================
   sendOffer
   ================================================================ */
describe("sendOffer", () => {
  beforeEach(() => {
    requireRoleMock.mockResolvedValue({ user: { id: "u1" }, role: "brand" });
  });

  it("rejects when offering_id is missing", async () => {
    const url = await catchRedirect(() =>
      sendOffer(
        fd({
          conversation_id: "c1",
          offering_id: "",
          price: "50",
          goals: "Increase reach",
        })
      )
    );
    expect(decodeURIComponent(url)).toContain("Pick an offering");
  });

  it("rejects invalid price", async () => {
    const url = await catchRedirect(() =>
      sendOffer(
        fd({
          conversation_id: "c1",
          offering_id: "off1",
          price: "abc",
          goals: "Increase reach",
        })
      )
    );
    expect(decodeURIComponent(url)).toContain("Pick an offering");
  });

  it("rejects empty goals", async () => {
    const url = await catchRedirect(() =>
      sendOffer(
        fd({
          conversation_id: "c1",
          offering_id: "off1",
          price: "50",
          goals: "",
        })
      )
    );
    expect(decodeURIComponent(url)).toContain("Pick an offering");
  });

  it("rejects product_description over 2000 chars", async () => {
    const url = await catchRedirect(() =>
      sendOffer(
        fd({
          conversation_id: "c1",
          offering_id: "off1",
          price: "50",
          goals: "Goals",
          product_description: "x".repeat(2001),
        })
      )
    );
    expect(decodeURIComponent(url)).toContain("Pick an offering");
  });

  it("rejects talking_points over 2000 chars", async () => {
    const url = await catchRedirect(() =>
      sendOffer(
        fd({
          conversation_id: "c1",
          offering_id: "off1",
          price: "50",
          goals: "Goals",
          product_description: "desc",
          talking_points: "x".repeat(2001),
        })
      )
    );
    expect(decodeURIComponent(url)).toContain("Pick an offering");
  });

  it("caps price when campaign_id is present", async () => {
    // campaigns.select().eq().maybeSingle() → mockResult("campaigns","maybeSingle")
    mockSb.mockResult("campaigns", "maybeSingle", {
      data: { budget_max_cents: 3000 },
      error: null,
    });
    // offers.insert → thenable
    mockSb.mockResult("offers", "insert", { error: null });
    // conversations.select().eq().maybeSingle() → mockResult("conversations","maybeSingle")
    mockSb.mockResult("conversations", "maybeSingle", {
      data: { creator_id: "cr1" },
      error: null,
    });

    const url = await catchRedirect(() =>
      sendOffer(
        fd({
          conversation_id: "c1",
          offering_id: "off1",
          price: "50",
          goals: "Goals",
          campaign_id: "camp1",
        })
      )
    );
    expect(url).toContain("/inbox/c1?saved=1");

    const { capOfferToCampaign } = await import("@/lib/campaigns/budget");
    // price "50" → parsePriceCents → 5000 cents; budget_max_cents = 3000
    expect(capOfferToCampaign).toHaveBeenCalledWith(5000, 3000);
  });

  it("does not cap price when campaign_id is absent", async () => {
    mockSb.mockResult("offers", "insert", { error: null });
    mockSb.mockResult("conversations", "maybeSingle", {
      data: { creator_id: "cr1" },
      error: null,
    });

    const url = await catchRedirect(() =>
      sendOffer(
        fd({
          conversation_id: "c1",
          offering_id: "off1",
          price: "50",
          goals: "Goals",
        })
      )
    );
    expect(url).toContain("/inbox/c1?saved=1");

    const { capOfferToCampaign } = await import("@/lib/campaigns/budget");
    expect(capOfferToCampaign).not.toHaveBeenCalled();
  });

  it("maps error 23505 to duplicate offer message", async () => {
    mockSb.mockResult("offers", "insert", {
      error: { code: "23505", message: "duplicate" },
    });

    const url = await catchRedirect(() =>
      sendOffer(
        fd({
          conversation_id: "c1",
          offering_id: "off1",
          price: "50",
          goals: "Goals",
        })
      )
    );
    expect(decodeURIComponent(url)).toContain(
      "You already have a pending offer"
    );
  });

  it("emails creator on success", async () => {
    mockSb.mockResult("offers", "insert", { error: null });
    mockSb.mockResult("conversations", "maybeSingle", {
      data: { creator_id: "cr1" },
      error: null,
    });

    await catchRedirect(() =>
      sendOffer(
        fd({
          conversation_id: "c1",
          offering_id: "off1",
          price: "50",
          goals: "Goals",
        })
      )
    );

    const { emailUser } = await import("@/lib/email");
    expect(emailUser).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "cr1" })
    );
  });
});

/* ================================================================
   respondOffer
   ================================================================ */
describe("respondOffer", () => {
  it("blocks accept when storefront is incomplete", async () => {
    getOnboardingStateMock.mockResolvedValue(INCOMPLETE_STATE);
    // conversations.select().eq().maybeSingle() → mockResult
    mockSb.mockResult("conversations", "maybeSingle", {
      data: { brand_id: "b1" },
      error: null,
    });

    const url = await catchRedirect(() =>
      respondOffer(
        fd({
          offer_id: "off1",
          conversation_id: "c1",
          response: "accepted",
        })
      )
    );
    expect(decodeURIComponent(url)).toContain("Complete your storefront");
  });

  it("accepts offer via RPC, emails brand, redirects to deal", async () => {
    mockSb.mockResult("conversations", "maybeSingle", {
      data: { brand_id: "b1" },
      error: null,
    });
    mockSb.mockRpc("accept_offer", { data: "deal-1", error: null });

    const url = await catchRedirect(() =>
      respondOffer(
        fd({
          offer_id: "off1",
          conversation_id: "c1",
          response: "accepted",
        })
      )
    );
    expect(url).toBe("/deals/deal-1");

    const { emailUser } = await import("@/lib/email");
    expect(emailUser).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "b1" })
    );
  });

  it("redirects with error when accept_offer RPC fails", async () => {
    mockSb.mockResult("conversations", "maybeSingle", {
      data: { brand_id: "b1" },
      error: null,
    });
    mockSb.mockRpc("accept_offer", {
      data: null,
      error: { code: "P0001", message: "Offer expired" },
    });

    const url = await catchRedirect(() =>
      respondOffer(
        fd({
          offer_id: "off1",
          conversation_id: "c1",
          response: "accepted",
        })
      )
    );
    expect(decodeURIComponent(url)).toContain("Offer expired");
  });

  it("declines offer and redirects to conversation", async () => {
    // Decline path: first from() = conversations maybeSingle, then offers update (thenable)
    vi.mocked(mockSb.supabase.from)
      .mockImplementationOnce(() => makeMaybeSingleChain({ brand_id: "b1" })) // conversations
      .mockImplementationOnce(() => makeMutationChain(null)); // offers.update().eq()

    const url = await catchRedirect(() =>
      respondOffer(
        fd({
          offer_id: "off1",
          conversation_id: "c1",
          response: "declined",
        })
      )
    );
    expect(url).toBe("/inbox/c1");
  });

  it("redirects with error when decline update fails", async () => {
    vi.mocked(mockSb.supabase.from)
      .mockImplementationOnce(() => makeMaybeSingleChain({ brand_id: "b1" })) // conversations
      .mockImplementationOnce(() =>
        makeMutationChain({ code: "42000", message: "fail" })
      ); // offers.update().eq()

    const url = await catchRedirect(() =>
      respondOffer(
        fd({
          offer_id: "off1",
          conversation_id: "c1",
          response: "declined",
        })
      )
    );
    expect(url).toContain("error=");
  });
});

/* ================================================================
   draftReply
   ================================================================ */
describe("draftReply", () => {
  beforeEach(() => {
    requireRoleMock.mockResolvedValue({ user: { id: "u1" }, role: "brand" });
  });

  it("rejects when conversation not found (null data)", async () => {
    // conversations check: from("conversations").select(...).eq(...).maybeSingle()
    // Use mockResult for the maybeSingle terminal
    mockSb.mockResult("conversations", "maybeSingle", {
      data: null,
      error: null,
    });

    const url = await catchRedirect(() =>
      draftReply(fd({ conversation_id: "c1" }))
    );
    expect(decodeURIComponent(url)).toContain(
      "Drafts are only available in your accepted conversations"
    );
  });

  it("rejects when brand_id does not match user", async () => {
    mockSb.mockResult("conversations", "maybeSingle", {
      data: {
        id: "c1",
        brand_id: "other-brand",
        creator_id: "cr1",
        status: "accepted",
        invite_message: "Hi",
      },
      error: null,
    });

    const url = await catchRedirect(() =>
      draftReply(fd({ conversation_id: "c1" }))
    );
    expect(decodeURIComponent(url)).toContain(
      "Drafts are only available in your accepted conversations"
    );
  });

  it("rejects when conversation status is not accepted", async () => {
    mockSb.mockResult("conversations", "maybeSingle", {
      data: {
        id: "c1",
        brand_id: "u1",
        creator_id: "cr1",
        status: "pending",
        invite_message: "Hi",
      },
      error: null,
    });

    const url = await catchRedirect(() =>
      draftReply(fd({ conversation_id: "c1" }))
    );
    expect(decodeURIComponent(url)).toContain(
      "Drafts are only available in your accepted conversations"
    );
  });

  it("redirects with LLM error when generatePlainText throws", async () => {
    // All from() calls in sequence:
    // 1. conversations → maybeSingle (guard check)
    // 2. messages (thread) → thenable list
    // 3. messages (myRecent) → thenable list
    // 4. brand_profiles → maybeSingle
    vi.mocked(mockSb.supabase.from)
      .mockImplementationOnce(() =>
        makeMaybeSingleChain({
          id: "c1",
          brand_id: "u1",
          creator_id: "cr1",
          status: "accepted",
          invite_message: "Hi",
        })
      ) // conversations
      .mockImplementationOnce(() => makeListChain([])) // messages thread
      .mockImplementationOnce(() => makeListChain([])) // messages myRecent
      .mockImplementationOnce(() =>
        makeMaybeSingleChain({ company: "Acme", description: "Widgets", notes: null })
      ); // brand_profiles

    generatePlainTextMock.mockRejectedValueOnce(new Error("LLM down"));

    const url = await catchRedirect(() =>
      draftReply(fd({ conversation_id: "c1" }))
    );
    expect(decodeURIComponent(url)).toContain("Drafting failed");
  });

  it("upserts draft on success and redirects to /inbox/c1", async () => {
    // All from() calls in sequence:
    // 1. conversations → maybeSingle
    // 2. messages (thread) → list
    // 3. messages (myRecent) → list
    // 4. brand_profiles → maybeSingle
    // 5. agent_drafts → upsert thenable
    vi.mocked(mockSb.supabase.from)
      .mockImplementationOnce(() =>
        makeMaybeSingleChain({
          id: "c1",
          brand_id: "u1",
          creator_id: "cr1",
          status: "accepted",
          invite_message: "Hi",
        })
      ) // conversations
      .mockImplementationOnce(() =>
        makeListChain([{ sender_id: "cr1", body: "Hey", created_at: "2026-01-01" }])
      ) // messages thread
      .mockImplementationOnce(() => makeListChain([])) // messages myRecent
      .mockImplementationOnce(() =>
        makeMaybeSingleChain({ company: "Acme", description: "Widgets", notes: null })
      ) // brand_profiles
      .mockImplementationOnce(() => makeMutationChain(null)); // agent_drafts upsert

    const url = await catchRedirect(() =>
      draftReply(fd({ conversation_id: "c1" }))
    );
    expect(url).toBe("/inbox/c1");
  });

  it("redirects with error when DB upsert fails", async () => {
    vi.mocked(mockSb.supabase.from)
      .mockImplementationOnce(() =>
        makeMaybeSingleChain({
          id: "c1",
          brand_id: "u1",
          creator_id: "cr1",
          status: "accepted",
          invite_message: "Hi",
        })
      ) // conversations
      .mockImplementationOnce(() => makeListChain([])) // messages thread
      .mockImplementationOnce(() => makeListChain([])) // messages myRecent
      .mockImplementationOnce(() =>
        makeMaybeSingleChain({ company: "Acme", description: null, notes: null })
      ) // brand_profiles
      .mockImplementationOnce(() =>
        makeMutationChain({ code: "23000", message: "upsert fail" })
      ); // agent_drafts upsert

    const url = await catchRedirect(() =>
      draftReply(fd({ conversation_id: "c1" }))
    );
    expect(decodeURIComponent(url)).toContain("Drafting failed");
  });
});

/* ================================================================
   archiveConversation
   ================================================================ */
describe("archiveConversation", () => {
  it("calls RPC set_conversation_archived with p_archived: true and redirects to /inbox", async () => {
    mockSb.mockRpc("set_conversation_archived", {
      data: null,
      error: null,
    });

    const url = await catchRedirect(() =>
      archiveConversation(fd({ conversation_id: "c1" }))
    );
    expect(url).toBe("/inbox");
  });

  it("redirects with friendlyDbError on RPC failure (P0001 message passthrough)", async () => {
    mockSb.mockRpc("set_conversation_archived", {
      data: null,
      error: { code: "P0001", message: "Not your conversation" },
    });

    const url = await catchRedirect(() =>
      archiveConversation(fd({ conversation_id: "c1" }))
    );
    expect(decodeURIComponent(url)).toContain("Not your conversation");
  });
});

/* ================================================================
   unarchiveConversation
   ================================================================ */
describe("unarchiveConversation", () => {
  it("calls RPC set_conversation_archived with p_archived: false and redirects to /inbox?status=archived", async () => {
    mockSb.mockRpc("set_conversation_archived", {
      data: null,
      error: null,
    });

    const url = await catchRedirect(() =>
      unarchiveConversation(fd({ conversation_id: "c1" }))
    );
    expect(url).toBe("/inbox?status=archived");
  });

  it("redirects with friendlyDbError on RPC failure", async () => {
    mockSb.mockRpc("set_conversation_archived", {
      data: null,
      error: { code: "P0001", message: "Nope" },
    });

    const url = await catchRedirect(() =>
      unarchiveConversation(fd({ conversation_id: "c1" }))
    );
    expect(decodeURIComponent(url)).toContain("Nope");
  });
});

/* ================================================================
   bulkArchiveConversations
   ================================================================ */
describe("bulkArchiveConversations", () => {
  it("archives multiple conversations and redirects to /inbox", async () => {
    // Single mockRpc value is reused for all iterations in the loop
    mockSb.mockRpc("set_conversation_archived", {
      data: null,
      error: null,
    });

    const url = await catchRedirect(() =>
      bulkArchiveConversations(
        fdMulti([
          ["conversation_id", "c1"],
          ["conversation_id", "c2"],
        ])
      )
    );
    expect(url).toBe("/inbox");
  });

  it("collects errors from multiple RPCs and joins with semicolon", async () => {
    // Each RPC in the loop reads the same stored mockRpc result → both fail
    // friendlyDbError with P0001 passes message through → "Forbidden; Forbidden"
    mockSb.mockRpc("set_conversation_archived", {
      data: null,
      error: { code: "P0001", message: "Forbidden" },
    });

    const url = await catchRedirect(() =>
      bulkArchiveConversations(
        fdMulti([
          ["conversation_id", "c1"],
          ["conversation_id", "c2"],
        ])
      )
    );
    expect(decodeURIComponent(url)).toContain("Forbidden; Forbidden");
  });
});
