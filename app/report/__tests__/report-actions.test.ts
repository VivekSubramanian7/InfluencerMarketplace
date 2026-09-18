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
  role: "creator",
});
vi.mock("@/lib/auth/require", () => ({
  requireUser: (...a: unknown[]) => requireUserMock(...a),
}));

import { createServerSupabase } from "@/lib/supabase/server";
import { fileReport } from "../actions";

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
  requireUserMock.mockResolvedValue({ user: { id: "u1" }, role: "creator" });
});

describe("fileReport", () => {
  it("rejects empty reason", async () => {
    const url = await catchRedirect(() =>
      fileReport(fd({ deal_id: "d1", reason: "" }))
    );
    expect(decodeURIComponent(url)).toContain(
      "Describe the problem (max 2000 characters)"
    );
  });

  it("rejects reason over 2000 chars", async () => {
    const url = await catchRedirect(() =>
      fileReport(fd({ deal_id: "d1", reason: "x".repeat(2001) }))
    );
    expect(decodeURIComponent(url)).toContain(
      "Describe the problem (max 2000 characters)"
    );
  });

  it("accepts reason of exactly 2000 chars and redirects to success", async () => {
    mockSb.mockResult("reports", "insert", { error: null });

    const url = await catchRedirect(() =>
      fileReport(fd({ deal_id: "d1", reason: "x".repeat(2000) }))
    );
    expect(url).toContain("/deals/d1?reported=1");
  });

  it("redirects to /deals?reported=1 when deal_id is empty", async () => {
    mockSb.mockResult("reports", "insert", { error: null });

    const url = await catchRedirect(() =>
      fileReport(fd({ deal_id: "", reason: "Spam account" }))
    );
    expect(url).toBe("/deals?reported=1");
  });

  it("redirects to /deals/{dealId}?reported=1 on success", async () => {
    mockSb.mockResult("reports", "insert", { error: null });

    const url = await catchRedirect(() =>
      fileReport(fd({ deal_id: "d1", reason: "Spam account" }))
    );
    expect(url).toContain("/deals/d1?reported=1");
  });

  it("redirects with error= on insert failure", async () => {
    mockSb.mockResult("reports", "insert", {
      error: { code: "23000", message: "constraint fail" },
    });

    const url = await catchRedirect(() =>
      fileReport(fd({ deal_id: "d1", reason: "Spam" }))
    );
    expect(url).toContain("error=");
  });

  it("error redirect goes to /report page (not /deals)", async () => {
    mockSb.mockResult("reports", "insert", {
      error: { code: "23000", message: "constraint fail" },
    });

    const url = await catchRedirect(() =>
      fileReport(fd({ deal_id: "d1", reason: "Spam" }))
    );
    expect(url).toMatch(/^\/report\?/);
  });

  it("validation error redirect includes deal param", async () => {
    const url = await catchRedirect(() =>
      fileReport(fd({ deal_id: "d1", reason: "" }))
    );
    expect(decodeURIComponent(url)).toContain("deal=d1");
  });

  it("validation error redirect goes to /report page (not /deals)", async () => {
    const url = await catchRedirect(() =>
      fileReport(fd({ deal_id: "d1", reason: "" }))
    );
    expect(url).toMatch(/^\/report\?/);
  });
});
