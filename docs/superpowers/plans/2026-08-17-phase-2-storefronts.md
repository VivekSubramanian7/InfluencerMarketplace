# Phase 2: Creator Storefronts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Creators can build and publish a public, bookable storefront: profile, productized offerings, portfolio links — rendered at `/c/[handle]` with ISR.

**Architecture:** All mutations are server actions gated by `requireRole("creator")`, writing through RLS with pure validation helpers (unit-tested, no I/O). Public storefront pages use a cookie-free anon Supabase client so they stay static/ISR (`revalidate = 300`), refreshed eagerly via `revalidatePath` after writes. One new migration splits the `for all` RLS policies (advisor WARN 0006) into explicit per-operation policies.

**Tech Stack:** Existing Phase 1 stack — Next.js 16 App Router, @supabase/ssr + supabase-js, Tailwind, Vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-16-video-micro-influencer-marketplace-design.md` (Phase 2 row) · Phase 1 plan carry-forward list applies.

## Global Constraints

- Local Supabase stack only (`npx supabase`, Docker); apply migrations with `npx supabase migration up`, iterate with `npx supabase db reset`. Never `db push`.
- All new tables/policies: RLS + explicit grants (this stack's default ACL gives app roles no DML — Phase 1 environment amendment).
- Money: `*_cents bigint`, `currency 'usd'` — UI accepts dollars, converts to cents; never floats in the DB.
- Offering types exactly: `dedicated_video|integration|short_form_post|ugc_video`. Creator statuses: `draft|live|suspended` (suspension transitions are admin/service-role only — trigger-enforced; the UI only toggles draft⇄live).
- Handle rule (mirrors DB check): `^[a-z0-9_]{3,30}$`.
- Server actions follow the `app/(auth)/actions.ts` pattern: `"use server"`, `createServerSupabase()`, `redirect()` NEVER inside try/catch.
- Protected pages open with `requireRole("creator")` from `lib/auth/require.ts` (returns `{ user, role }`).
- Public pages must NOT import `lib/supabase/server.ts` (cookie access forces dynamic rendering) — use `lib/supabase/public.ts` (Task 3).
- Commit after every task (green tests only). `npm test`, `npm run lint`, `npm run build` all clean before each commit.
- Verification stats come only from `public.public_creator_stats` (empty until Phase 5) — the storefront must render a "verification pending" state, never fake numbers (spec: never silently show dead stats).

---

### Task 1: Migration 0006 — split for-all policies (advisor fix)

**Files:**
- Create: `supabase/migrations/0006_policy_split.sql`

**Interfaces:**
- Produces: unchanged access semantics; the advisor WARN `multiple_permissive_policies` on `offerings`/`portfolio_items` disappears. No app code depends on policy names.

- [ ] **Step 1: Write the migration**

`supabase/migrations/0006_policy_split.sql`:
```sql
-- Advisor fix (Phase 1 carry-forward): the "manage own" FOR ALL policies on
-- offerings/portfolio_items each add a second permissive SELECT policy on top
-- of the public-read policy. Split into per-operation policies; SELECT stays
-- solely with the public-read policies. Access semantics are unchanged:
-- owners could already see their own rows via the public policies
-- ("active = true OR owner" on offerings; unconditional on portfolio_items).

drop policy "creators manage own offerings" on public.offerings;
create policy "creators insert own offerings"
  on public.offerings for insert
  with check ((select auth.uid()) = creator_id);
create policy "creators update own offerings"
  on public.offerings for update
  using ((select auth.uid()) = creator_id)
  with check ((select auth.uid()) = creator_id);
create policy "creators delete own offerings"
  on public.offerings for delete
  using ((select auth.uid()) = creator_id);

drop policy "creators manage own portfolio" on public.portfolio_items;
create policy "creators insert own portfolio"
  on public.portfolio_items for insert
  with check ((select auth.uid()) = creator_id);
create policy "creators update own portfolio"
  on public.portfolio_items for update
  using ((select auth.uid()) = creator_id)
  with check ((select auth.uid()) = creator_id);
create policy "creators delete own portfolio"
  on public.portfolio_items for delete
  using ((select auth.uid()) = creator_id);
```

- [ ] **Step 2: Apply** — `npx supabase migration up`. Expected: clean.

- [ ] **Step 3: Verify** — via `docker exec supabase_db_InfluencerMarketplace psql -U postgres -d postgres -c "..."`:
```sql
select count(*) from pg_policies where schemaname='public'
  and tablename in ('offerings','portfolio_items');
```
Expected: 8 (1 public-select + 3 per-op, per table). Then run `npx supabase db advisors --local` — the `multiple_permissive_policies` WARNs for these two tables are gone (the `security_definer_view` ERROR and `extension_in_public` WARN remain; both are triaged carry-forwards).

- [ ] **Step 4: Commit**

```bash
git add supabase
git commit -m "fix: split for-all RLS policies to clear multiple-permissive-policy advisor warning"
```

---

### Task 2: Storefront validation helpers (pure, TDD)

**Files:**
- Create: `lib/storefront/validation.ts`
- Test: `lib/storefront/__tests__/validation.test.ts`

**Interfaces:**
- Produces (consumed by Tasks 4-6 server actions):
  - `parseHandle(raw: string): string | null` — trims, lowercases; null unless `^[a-z0-9_]{3,30}$`
  - `parsePriceCents(raw: string): number | null` — dollars string → integer cents; null unless 1.00 ≤ price ≤ 1,000,000.00 with ≤ 2 decimals
  - `parseTags(raw: string, max?: number): string[]` — comma-separated → trimmed, lowercased, deduped, empties dropped, each ≤ 30 chars, capped at `max` (default 8)
  - `parseIntInRange(raw: string, min: number, max: number): number | null`
  - `parseMediaUrl(raw: string): string | null` — valid absolute http(s) URL or null
  - `parseText(raw: string, maxLen: number): string | null` — trimmed; null if empty or over maxLen

- [ ] **Step 1: Write the failing tests**

`lib/storefront/__tests__/validation.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  parseHandle, parsePriceCents, parseTags,
  parseIntInRange, parseMediaUrl, parseText,
} from "@/lib/storefront/validation";

describe("parseHandle", () => {
  it("lowercases and trims valid handles", () => {
    expect(parseHandle("  MyHandle_1 ")).toBe("myhandle_1");
  });
  it("rejects bad handles", () => {
    expect(parseHandle("ab")).toBeNull();            // too short
    expect(parseHandle("a".repeat(31))).toBeNull();  // too long
    expect(parseHandle("has space")).toBeNull();
    expect(parseHandle("dash-ed")).toBeNull();
    expect(parseHandle("")).toBeNull();
  });
});

describe("parsePriceCents", () => {
  it("converts dollars to integer cents", () => {
    expect(parsePriceCents("250")).toBe(25000);
    expect(parsePriceCents("99.99")).toBe(9999);
    expect(parsePriceCents(" 1.5 ")).toBe(150);
  });
  it("rejects invalid prices", () => {
    expect(parsePriceCents("0")).toBeNull();
    expect(parsePriceCents("0.99")).toBeNull();      // below $1 floor
    expect(parsePriceCents("1000000.01")).toBeNull();
    expect(parsePriceCents("12.345")).toBeNull();    // 3 decimals
    expect(parsePriceCents("abc")).toBeNull();
    expect(parsePriceCents("-5")).toBeNull();
  });
  it("never produces float drift", () => {
    expect(parsePriceCents("19.99")).toBe(1999);     // not 1998.9999…
  });
});

describe("parseTags", () => {
  it("splits, trims, lowercases, dedupes, drops empties", () => {
    expect(parseTags(" Gaming, tech,, GAMING , beauty ")).toEqual([
      "gaming", "tech", "beauty",
    ]);
  });
  it("caps count and length", () => {
    expect(parseTags("a,b,c", 2)).toEqual(["a", "b"]);
    expect(parseTags("x".repeat(31))).toEqual([]);
  });
});

describe("parseIntInRange", () => {
  it("parses in-range integers", () => {
    expect(parseIntInRange("14", 1, 90)).toBe(14);
  });
  it("rejects out-of-range and non-integers", () => {
    expect(parseIntInRange("0", 1, 90)).toBeNull();
    expect(parseIntInRange("91", 1, 90)).toBeNull();
    expect(parseIntInRange("2.5", 1, 90)).toBeNull();
    expect(parseIntInRange("", 1, 90)).toBeNull();
  });
});

describe("parseMediaUrl", () => {
  it("accepts absolute http(s) urls", () => {
    expect(parseMediaUrl("https://youtube.com/watch?v=x")).toBe("https://youtube.com/watch?v=x");
  });
  it("rejects other schemes and garbage", () => {
    expect(parseMediaUrl("javascript:alert(1)")).toBeNull();
    expect(parseMediaUrl("ftp://x")).toBeNull();
    expect(parseMediaUrl("not a url")).toBeNull();
  });
});

describe("parseText", () => {
  it("trims and enforces max length", () => {
    expect(parseText("  hi  ", 10)).toBe("hi");
    expect(parseText("", 10)).toBeNull();
    expect(parseText("x".repeat(11), 10)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run lib/storefront/__tests__/validation.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement**

`lib/storefront/validation.ts`:
```ts
const HANDLE_RE = /^[a-z0-9_]{3,30}$/;

export function parseHandle(raw: string): string | null {
  const h = raw.trim().toLowerCase();
  return HANDLE_RE.test(h) ? h : null;
}

export function parsePriceCents(raw: string): number | null {
  const s = raw.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [dollars, decimals = ""] = s.split(".");
  const cents = parseInt(dollars, 10) * 100 + parseInt(decimals.padEnd(2, "0") || "0", 10);
  if (cents < 100 || cents > 100_000_000) return null;
  return cents;
}

export function parseTags(raw: string, max = 8): string[] {
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const tag = part.trim().toLowerCase();
    if (tag.length >= 1 && tag.length <= 30) seen.add(tag);
    if (seen.size === max) break;
  }
  return [...seen];
}

export function parseIntInRange(raw: string, min: number, max: number): number | null {
  const s = raw.trim();
  if (!/^-?\d+$/.test(s)) return null;
  const n = parseInt(s, 10);
  return n >= min && n <= max ? n : null;
}

export function parseMediaUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function parseText(raw: string, maxLen: number): string | null {
  const t = raw.trim();
  return t.length >= 1 && t.length <= maxLen ? t : null;
}
```

- [ ] **Step 4: Run tests** — `npx vitest run lib/storefront/__tests__/validation.test.ts` → PASS; then `npm test` → all green.

- [ ] **Step 5: Commit**

```bash
git add lib/storefront
git commit -m "feat: pure validation helpers for storefront forms"
```

---

### Task 3: Public Supabase client + storefront queries

**Files:**
- Create: `lib/supabase/public.ts`, `lib/storefront/queries.ts`

**Interfaces:**
- Produces:
  - `createPublicClient()` — cookie-free supabase-js client (anon key); ONLY for public read paths (storefront, discovery). Never carries a user session.
  - `getStorefront(handle: string): Promise<Storefront | null>` — null when no live creator with that handle. Type:
    ```ts
    interface Storefront {
      profile: { userId: string; handle: string; bio: string | null;
                 niches: string[]; country: string | null; languages: string[];
                 displayName: string | null; avatarUrl: string | null };
      offerings: Array<{ id: string; type: string; title: string;
                         description: string | null; priceCents: number;
                         currency: string; turnaroundDays: number;
                         revisionLimit: number }>;
      portfolio: Array<{ id: string; mediaUrl: string; caption: string | null }>;
      stats: Array<{ platform: string; platformHandle: string;
                     followerCount: number | null; avgViews: number | null;
                     engagementRate: number | null; verificationStatus: string;
                     lastSyncedAt: string | null }>;
    }
    ```
- Consumes: `public_creator_stats` view, `creator_profiles`/`offerings`/`portfolio_items` public RLS policies (live creators / active offerings only for anon).

- [ ] **Step 1: Public client**

`lib/supabase/public.ts`:
```ts
import { createClient } from "@supabase/supabase-js";

// Cookie-free anon client for PUBLIC read paths (storefront, discovery).
// Never use in authenticated flows — it has no user session, and importing
// the cookie-bound server client would force these pages dynamic.
export function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
```

- [ ] **Step 2: Storefront query**

`lib/storefront/queries.ts`:
```ts
import { createPublicClient } from "@/lib/supabase/public";

export interface Storefront {
  profile: {
    userId: string; handle: string; bio: string | null; niches: string[];
    country: string | null; languages: string[];
    displayName: string | null; avatarUrl: string | null;
  };
  offerings: Array<{
    id: string; type: string; title: string; description: string | null;
    priceCents: number; currency: string; turnaroundDays: number; revisionLimit: number;
  }>;
  portfolio: Array<{ id: string; mediaUrl: string; caption: string | null }>;
  stats: Array<{
    platform: string; platformHandle: string; followerCount: number | null;
    avgViews: number | null; engagementRate: number | null;
    verificationStatus: string; lastSyncedAt: string | null;
  }>;
}

export async function getStorefront(handle: string): Promise<Storefront | null> {
  const supabase = createPublicClient();

  const { data: cp } = await supabase
    .from("creator_profiles")
    .select("user_id, handle, bio, niches, country, languages, status")
    .eq("handle", handle)
    .eq("status", "live")
    .maybeSingle();
  if (!cp) return null;

  const [{ data: prof }, { data: offerings }, { data: portfolio }, { data: stats }] =
    await Promise.all([
      supabase.from("profiles").select("display_name, avatar_url").eq("id", cp.user_id).maybeSingle(),
      supabase.from("offerings")
        .select("id, type, title, description, price_cents, currency, turnaround_days, revision_limit")
        .eq("creator_id", cp.user_id).eq("active", true).order("price_cents"),
      supabase.from("portfolio_items")
        .select("id, media_url, caption")
        .eq("creator_id", cp.user_id).order("created_at", { ascending: false }),
      supabase.from("public_creator_stats")
        .select("platform, platform_handle, follower_count, avg_views, engagement_rate, verification_status, last_synced_at")
        .eq("creator_id", cp.user_id),
    ]);

  return {
    profile: {
      userId: cp.user_id, handle: cp.handle, bio: cp.bio,
      niches: cp.niches ?? [], country: cp.country, languages: cp.languages ?? [],
      displayName: prof?.display_name ?? null, avatarUrl: prof?.avatar_url ?? null,
    },
    offerings: (offerings ?? []).map((o) => ({
      id: o.id, type: o.type, title: o.title, description: o.description,
      priceCents: o.price_cents, currency: o.currency,
      turnaroundDays: o.turnaround_days, revisionLimit: o.revision_limit,
    })),
    portfolio: (portfolio ?? []).map((p) => ({
      id: p.id, mediaUrl: p.media_url, caption: p.caption,
    })),
    stats: (stats ?? []).map((s) => ({
      platform: s.platform, platformHandle: s.platform_handle,
      followerCount: s.follower_count, avgViews: s.avg_views,
      engagementRate: s.engagement_rate, verificationStatus: s.verification_status,
      lastSyncedAt: s.last_synced_at,
    })),
  };
}
```

- [ ] **Step 3: Verify** — `npm run build` clean; `npm test` green (no new tests: this is I/O glue verified end-to-end in Task 8).

- [ ] **Step 4: Commit**

```bash
git add lib/supabase/public.ts lib/storefront/queries.ts
git commit -m "feat: public anon client and storefront query"
```

---

### Task 4: Creator profile form + publish toggle

**Files:**
- Create: `app/dashboard/profile/page.tsx`, `app/dashboard/profile/actions.ts`

**Interfaces:**
- Consumes: `requireRole("creator")`, `createServerSupabase()`, validation helpers (Task 2).
- Produces: server actions `saveCreatorProfile(formData)` and `setProfileStatus(formData)` (formData key `status`: `"draft"|"live"`); route `/dashboard/profile`. Both call `revalidatePath("/c/" + handle)` after writes. Task 7's dashboard links here.

- [ ] **Step 1: Server actions**

`app/dashboard/profile/actions.ts`:
```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseHandle, parseTags, parseText } from "@/lib/storefront/validation";

export async function saveCreatorProfile(formData: FormData) {
  const { user } = await requireRole("creator");
  const supabase = await createServerSupabase();

  const handle = parseHandle(String(formData.get("handle") ?? ""));
  if (!handle) redirect("/dashboard/profile?error=" + encodeURIComponent("Handle must be 3-30 chars: a-z, 0-9, _"));

  const bio = parseText(String(formData.get("bio") ?? ""), 1000);
  const country = parseText(String(formData.get("country") ?? ""), 60);
  const niches = parseTags(String(formData.get("niches") ?? ""));
  const languages = parseTags(String(formData.get("languages") ?? ""), 5);

  const { error } = await supabase.from("creator_profiles").upsert({
    user_id: user.id, handle, bio, country, niches, languages,
  });
  if (error) {
    const msg = error.code === "23505" ? "That handle is taken" : error.message;
    redirect("/dashboard/profile?error=" + encodeURIComponent(msg));
  }

  revalidatePath(`/c/${handle}`);
  redirect("/dashboard/profile?saved=1");
}

export async function setProfileStatus(formData: FormData) {
  const { user } = await requireRole("creator");
  const supabase = await createServerSupabase();
  const status = formData.get("status") === "live" ? "live" : "draft";

  const { data: row, error } = await supabase
    .from("creator_profiles")
    .update({ status })
    .eq("user_id", user.id)
    .select("handle")
    .maybeSingle();
  if (error || !row) {
    redirect("/dashboard/profile?error=" + encodeURIComponent(error?.message ?? "Create your profile first"));
  }

  revalidatePath(`/c/${row.handle}`);
  redirect("/dashboard/profile?saved=1");
}
```

- [ ] **Step 2: Page**

`app/dashboard/profile/page.tsx`:
```tsx
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { saveCreatorProfile, setProfileStatus } from "./actions";

export default async function CreatorProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { user } = await requireRole("creator");
  const { error, saved } = await searchParams;
  const supabase = await createServerSupabase();
  const { data: p } = await supabase
    .from("creator_profiles")
    .select("handle, bio, niches, country, languages, status")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-2xl font-semibold mb-2">Your creator profile</h1>
      {p && (
        <p className="mb-4 text-sm">
          Status: <span className="font-medium">{p.status}</span>
          {p.status === "live" && (
            <> — public at <a className="underline" href={`/c/${p.handle}`}>/c/{p.handle}</a></>
          )}
        </p>
      )}
      {error && <p className="mb-4 text-red-600">{error}</p>}
      {saved && <p className="mb-4 text-green-700">Saved.</p>}

      <form action={saveCreatorProfile} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span>Handle (your public URL: /c/…)</span>
          <input name="handle" defaultValue={p?.handle ?? ""} className="border rounded p-2" required />
        </label>
        <label className="flex flex-col gap-1">
          <span>Bio</span>
          <textarea name="bio" defaultValue={p?.bio ?? ""} rows={4} className="border rounded p-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span>Niches (comma-separated, up to 8)</span>
          <input name="niches" defaultValue={(p?.niches ?? []).join(", ")} className="border rounded p-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span>Country</span>
          <input name="country" defaultValue={p?.country ?? ""} className="border rounded p-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span>Languages (comma-separated, up to 5)</span>
          <input name="languages" defaultValue={(p?.languages ?? []).join(", ")} className="border rounded p-2" />
        </label>
        <button className="bg-black text-white rounded p-2">Save profile</button>
      </form>

      {p && (
        <form action={setProfileStatus} className="mt-6">
          <input type="hidden" name="status" value={p.status === "live" ? "draft" : "live"} />
          <button className="border rounded p-2 w-full">
            {p.status === "live" ? "Unpublish (back to draft)" : "Publish storefront"}
          </button>
        </form>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Verify** — `npm run build` clean. Manual (dev server + a creator account): save a profile with handle `testcreator1`, publish it; confirm the row via psql (`select handle, status from creator_profiles;`), duplicate-handle error shows the friendly message, and a brand account visiting `/dashboard/profile` bounces to `/`.

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/profile
git commit -m "feat: creator profile form with publish toggle"
```

---

### Task 5: Offerings CRUD

**Files:**
- Create: `app/dashboard/offerings/page.tsx`, `app/dashboard/offerings/actions.ts`

**Interfaces:**
- Consumes: validation helpers, `requireRole("creator")`, offering type enum values.
- Produces: server actions `saveOffering(formData)` (formData `id` empty = create, else update), `toggleOffering(formData)` (id + active), `deleteOffering(formData)` (id); route `/dashboard/offerings`. Each revalidates `/c/[handle]`.

- [ ] **Step 1: Server actions**

`app/dashboard/offerings/actions.ts`:
```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseIntInRange, parsePriceCents, parseText } from "@/lib/storefront/validation";

const OFFERING_TYPES = ["dedicated_video", "integration", "short_form_post", "ugc_video"] as const;

async function creatorHandle(supabase: Awaited<ReturnType<typeof createServerSupabase>>, userId: string) {
  const { data } = await supabase
    .from("creator_profiles").select("handle").eq("user_id", userId).maybeSingle();
  return data?.handle as string | undefined;
}

export async function saveOffering(formData: FormData) {
  const { user } = await requireRole("creator");
  const supabase = await createServerSupabase();

  const handle = await creatorHandle(supabase, user.id);
  if (!handle) redirect("/dashboard/profile?error=" + encodeURIComponent("Create your profile before adding offerings"));

  const type = String(formData.get("type") ?? "");
  const title = parseText(String(formData.get("title") ?? ""), 80);
  const description = parseText(String(formData.get("description") ?? ""), 2000);
  const priceCents = parsePriceCents(String(formData.get("price") ?? ""));
  const turnaround = parseIntInRange(String(formData.get("turnaround_days") ?? ""), 1, 90);
  const revisions = parseIntInRange(String(formData.get("revision_limit") ?? ""), 0, 5);

  if (!OFFERING_TYPES.includes(type as (typeof OFFERING_TYPES)[number]) || !title || !priceCents || turnaround === null || revisions === null) {
    redirect("/dashboard/offerings?error=" + encodeURIComponent("Check the form: title (≤80), price $1–$1,000,000, turnaround 1–90 days, revisions 0–5"));
  }

  const id = String(formData.get("id") ?? "");
  const row = {
    creator_id: user.id, type, title, description,
    price_cents: priceCents, turnaround_days: turnaround, revision_limit: revisions,
  };
  const { error } = id
    ? await supabase.from("offerings").update(row).eq("id", id).eq("creator_id", user.id)
    : await supabase.from("offerings").insert(row);
  if (error) redirect("/dashboard/offerings?error=" + encodeURIComponent(error.message));

  revalidatePath(`/c/${handle}`);
  redirect("/dashboard/offerings?saved=1");
}

export async function toggleOffering(formData: FormData) {
  const { user } = await requireRole("creator");
  const supabase = await createServerSupabase();
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";

  const { error } = await supabase
    .from("offerings").update({ active }).eq("id", id).eq("creator_id", user.id);
  if (error) redirect("/dashboard/offerings?error=" + encodeURIComponent(error.message));

  const handle = await creatorHandle(supabase, user.id);
  if (handle) revalidatePath(`/c/${handle}`);
  redirect("/dashboard/offerings?saved=1");
}

export async function deleteOffering(formData: FormData) {
  const { user } = await requireRole("creator");
  const supabase = await createServerSupabase();
  const id = String(formData.get("id") ?? "");

  const { error } = await supabase
    .from("offerings").delete().eq("id", id).eq("creator_id", user.id);
  if (error) redirect("/dashboard/offerings?error=" + encodeURIComponent(error.message));

  const handle = await creatorHandle(supabase, user.id);
  if (handle) revalidatePath(`/c/${handle}`);
  redirect("/dashboard/offerings?saved=1");
}
```

- [ ] **Step 2: Page**

`app/dashboard/offerings/page.tsx`:
```tsx
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { deleteOffering, saveOffering, toggleOffering } from "./actions";

const TYPE_LABELS: Record<string, string> = {
  dedicated_video: "Dedicated video",
  integration: "Integration (60-90s)",
  short_form_post: "Short-form post",
  ugc_video: "UGC video (no posting)",
};

export default async function OfferingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { user } = await requireRole("creator");
  const { error, saved } = await searchParams;
  const supabase = await createServerSupabase();
  const { data: offerings } = await supabase
    .from("offerings")
    .select("id, type, title, description, price_cents, turnaround_days, revision_limit, active")
    .eq("creator_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold mb-4">Your offerings</h1>
      {error && <p className="mb-4 text-red-600">{error}</p>}
      {saved && <p className="mb-4 text-green-700">Saved.</p>}

      <ul className="flex flex-col gap-3 mb-8">
        {(offerings ?? []).map((o) => (
          <li key={o.id} className="border rounded p-4">
            <div className="flex justify-between items-baseline">
              <span className="font-medium">{o.title}</span>
              <span>${(o.price_cents / 100).toFixed(2)}</span>
            </div>
            <p className="text-sm text-gray-600">
              {TYPE_LABELS[o.type] ?? o.type} · {o.turnaround_days}d turnaround ·{" "}
              {o.revision_limit} revisions · {o.active ? "active" : "hidden"}
            </p>
            <div className="flex gap-2 mt-2">
              <form action={toggleOffering}>
                <input type="hidden" name="id" value={o.id} />
                <input type="hidden" name="active" value={o.active ? "false" : "true"} />
                <button className="text-sm underline">{o.active ? "Hide" : "Activate"}</button>
              </form>
              <form action={deleteOffering}>
                <input type="hidden" name="id" value={o.id} />
                <button className="text-sm underline text-red-600">Delete</button>
              </form>
            </div>
          </li>
        ))}
        {(offerings ?? []).length === 0 && (
          <li className="text-gray-600">No offerings yet — add your first below.</li>
        )}
      </ul>

      <h2 className="text-lg font-medium mb-3">Add an offering</h2>
      <form action={saveOffering} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span>Type</span>
          <select name="type" className="border rounded p-2" defaultValue="dedicated_video">
            {Object.entries(TYPE_LABELS).map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span>Title</span>
          <input name="title" className="border rounded p-2" required />
        </label>
        <label className="flex flex-col gap-1">
          <span>Description</span>
          <textarea name="description" rows={3} className="border rounded p-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span>Price (USD)</span>
          <input name="price" inputMode="decimal" className="border rounded p-2" required />
        </label>
        <label className="flex flex-col gap-1">
          <span>Turnaround (days)</span>
          <input name="turnaround_days" type="number" defaultValue={14} className="border rounded p-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span>Included revisions</span>
          <input name="revision_limit" type="number" defaultValue={1} className="border rounded p-2" />
        </label>
        <button className="bg-black text-white rounded p-2">Save offering</button>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Verify** — `npm run build` clean; manual: create two offerings, hide one, delete one; confirm rows via psql; invalid price shows the friendly error.

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/offerings
git commit -m "feat: offerings CRUD for creators"
```

---

### Task 6: Portfolio links

**Files:**
- Create: `app/dashboard/portfolio/page.tsx`, `app/dashboard/portfolio/actions.ts`

**Interfaces:**
- Consumes: `parseMediaUrl`, `parseText`, `requireRole("creator")`.
- Produces: server actions `addPortfolioItem(formData)` (media_url, caption), `deletePortfolioItem(formData)` (id); route `/dashboard/portfolio`. Revalidates `/c/[handle]`.

- [ ] **Step 1: Server actions**

`app/dashboard/portfolio/actions.ts`:
```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseMediaUrl, parseText } from "@/lib/storefront/validation";

export async function addPortfolioItem(formData: FormData) {
  const { user } = await requireRole("creator");
  const supabase = await createServerSupabase();

  const mediaUrl = parseMediaUrl(String(formData.get("media_url") ?? ""));
  if (!mediaUrl) redirect("/dashboard/portfolio?error=" + encodeURIComponent("Enter a valid http(s) link to your video"));
  const caption = parseText(String(formData.get("caption") ?? ""), 200);

  const { error } = await supabase
    .from("portfolio_items")
    .insert({ creator_id: user.id, media_url: mediaUrl, caption });
  if (error) redirect("/dashboard/portfolio?error=" + encodeURIComponent(error.message));

  const { data: p } = await supabase
    .from("creator_profiles").select("handle").eq("user_id", user.id).maybeSingle();
  if (p?.handle) revalidatePath(`/c/${p.handle}`);
  redirect("/dashboard/portfolio?saved=1");
}

export async function deletePortfolioItem(formData: FormData) {
  const { user } = await requireRole("creator");
  const supabase = await createServerSupabase();
  const id = String(formData.get("id") ?? "");

  const { error } = await supabase
    .from("portfolio_items").delete().eq("id", id).eq("creator_id", user.id);
  if (error) redirect("/dashboard/portfolio?error=" + encodeURIComponent(error.message));

  const { data: p } = await supabase
    .from("creator_profiles").select("handle").eq("user_id", user.id).maybeSingle();
  if (p?.handle) revalidatePath(`/c/${p.handle}`);
  redirect("/dashboard/portfolio?saved=1");
}
```

- [ ] **Step 2: Page**

`app/dashboard/portfolio/page.tsx`:
```tsx
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { addPortfolioItem, deletePortfolioItem } from "./actions";

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { user } = await requireRole("creator");
  const { error, saved } = await searchParams;
  const supabase = await createServerSupabase();
  const { data: items } = await supabase
    .from("portfolio_items")
    .select("id, media_url, caption")
    .eq("creator_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-2xl font-semibold mb-4">Your portfolio</h1>
      <p className="text-sm text-gray-600 mb-4">
        Link your best videos (YouTube, TikTok, Instagram). Brands see these on your storefront.
      </p>
      {error && <p className="mb-4 text-red-600">{error}</p>}
      {saved && <p className="mb-4 text-green-700">Saved.</p>}

      <ul className="flex flex-col gap-3 mb-8">
        {(items ?? []).map((item) => (
          <li key={item.id} className="border rounded p-4 flex justify-between items-center gap-4">
            <div className="min-w-0">
              <a href={item.media_url} target="_blank" rel="noopener noreferrer" className="underline break-all">
                {item.media_url}
              </a>
              {item.caption && <p className="text-sm text-gray-600">{item.caption}</p>}
            </div>
            <form action={deletePortfolioItem}>
              <input type="hidden" name="id" value={item.id} />
              <button className="text-sm underline text-red-600">Remove</button>
            </form>
          </li>
        ))}
        {(items ?? []).length === 0 && <li className="text-gray-600">Nothing here yet.</li>}
      </ul>

      <form action={addPortfolioItem} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span>Video link</span>
          <input name="media_url" type="url" className="border rounded p-2" required />
        </label>
        <label className="flex flex-col gap-1">
          <span>Caption (optional)</span>
          <input name="caption" className="border rounded p-2" />
        </label>
        <button className="bg-black text-white rounded p-2">Add to portfolio</button>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Verify** — `npm run build` clean; manual: add two links (one YouTube, one TikTok), remove one; `javascript:` URL rejected with friendly error.

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/portfolio
git commit -m "feat: portfolio links for creators"
```

---

### Task 7: Creator dashboard home (setup checklist)

**Files:**
- Modify: `app/dashboard/page.tsx` (replace the Phase-1 placeholder entirely)

**Interfaces:**
- Consumes: `requireRole("creator")`, `createServerSupabase()`; routes from Tasks 4-6.
- Produces: `/dashboard` — setup checklist (profile → offerings → portfolio → publish) with live links; the creator home for all later phases.

- [ ] **Step 1: Replace the placeholder**

`app/dashboard/page.tsx`:
```tsx
import Link from "next/link";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { logout } from "@/app/(auth)/actions";

export default async function DashboardPage() {
  const { user } = await requireRole("creator");
  const supabase = await createServerSupabase();

  const [{ data: profile }, { count: offeringCount }, { count: portfolioCount }] =
    await Promise.all([
      supabase.from("creator_profiles").select("handle, status").eq("user_id", user.id).maybeSingle(),
      supabase.from("offerings").select("id", { count: "exact", head: true }).eq("creator_id", user.id),
      supabase.from("portfolio_items").select("id", { count: "exact", head: true }).eq("creator_id", user.id),
    ]);

  const steps = [
    { done: !!profile, label: "Create your profile", href: "/dashboard/profile" },
    { done: (offeringCount ?? 0) > 0, label: "Add at least one offering", href: "/dashboard/offerings" },
    { done: (portfolioCount ?? 0) > 0, label: "Link portfolio videos", href: "/dashboard/portfolio" },
    { done: profile?.status === "live", label: "Publish your storefront", href: "/dashboard/profile" },
  ];

  return (
    <main className="mx-auto max-w-xl p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Creator dashboard</h1>
        <form action={logout}><button className="text-sm underline">Log out</button></form>
      </div>

      {profile?.status === "live" ? (
        <p className="mb-6">
          Your storefront is live:{" "}
          <a className="underline font-medium" href={`/c/${profile.handle}`}>/c/{profile.handle}</a>
        </p>
      ) : (
        <p className="mb-6 text-gray-600">Complete these steps to go live:</p>
      )}

      <ol className="flex flex-col gap-3">
        {steps.map((s) => (
          <li key={s.label} className="border rounded p-4 flex items-center gap-3">
            <span aria-hidden>{s.done ? "✅" : "⬜"}</span>
            <Link className="underline" href={s.href}>{s.label}</Link>
          </li>
        ))}
      </ol>
    </main>
  );
}
```

- [ ] **Step 2: Verify** — `npm run build` clean; manual: fresh creator sees 0/4 checked; each step flips as completed; logout works.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat: creator dashboard with setup checklist"
```

---

### Task 8: Public storefront `/c/[handle]` (ISR)

**Files:**
- Create: `app/c/[handle]/page.tsx`

**Interfaces:**
- Consumes: `getStorefront(handle)` (Task 3) — MUST NOT import `lib/supabase/server.ts`.
- Produces: public route `/c/[handle]`; 404 for unknown/draft handles; Phase 3 discovery cards link here; Phase 4's booking flow adds a Book button per offering (this page renders offerings with stable `data-offering-id` anchors it can extend).

- [ ] **Step 1: The page**

`app/c/[handle]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { getStorefront } from "@/lib/storefront/queries";

export const revalidate = 300;

const TYPE_LABELS: Record<string, string> = {
  dedicated_video: "Dedicated video",
  integration: "Integration (60-90s)",
  short_form_post: "Short-form post",
  ugc_video: "UGC video (no posting)",
};

const PLATFORM_LABELS: Record<string, string> = {
  youtube: "YouTube", tiktok: "TikTok", instagram: "Instagram",
};

export default async function StorefrontPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const storefront = await getStorefront(handle.toLowerCase());
  if (!storefront) notFound();
  const { profile, offerings, portfolio, stats } = storefront;

  return (
    <main className="mx-auto max-w-3xl p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold">
          {profile.displayName ?? `@${profile.handle}`}
        </h1>
        <p className="text-gray-600">@{profile.handle}{profile.country ? ` · ${profile.country}` : ""}</p>
        {profile.bio && <p className="mt-3 whitespace-pre-line">{profile.bio}</p>}
        {profile.niches.length > 0 && (
          <ul className="flex flex-wrap gap-2 mt-3">
            {profile.niches.map((n) => (
              <li key={n} className="border rounded-full px-3 py-1 text-sm">{n}</li>
            ))}
          </ul>
        )}
      </header>

      <section className="mb-8">
        <h2 className="text-xl font-medium mb-3">Audience</h2>
        {stats.length === 0 ? (
          <p className="text-gray-600 text-sm border rounded p-4">
            Platform verification pending — stats will appear once this creator
            connects their accounts.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-3">
            {stats.map((s) => (
              <li key={s.platform} className="border rounded p-4">
                <p className="font-medium">{PLATFORM_LABELS[s.platform] ?? s.platform}</p>
                <p className="text-sm text-gray-600">@{s.platformHandle}</p>
                {s.verificationStatus === "verified" && s.followerCount !== null ? (
                  <>
                    <p className="mt-1">{Intl.NumberFormat().format(s.followerCount)} followers</p>
                    {s.avgViews !== null && (
                      <p className="text-sm text-gray-600">{Intl.NumberFormat().format(s.avgViews)} avg views</p>
                    )}
                    {s.lastSyncedAt && (
                      <p className="text-xs text-gray-400 mt-1">
                        Verified · updated {new Date(s.lastSyncedAt).toLocaleDateString()}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-gray-500 mt-1">Verification {s.verificationStatus}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-medium mb-3">Offerings</h2>
        {offerings.length === 0 ? (
          <p className="text-gray-600">No offerings listed yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {offerings.map((o) => (
              <li key={o.id} data-offering-id={o.id} className="border rounded p-4">
                <div className="flex justify-between items-baseline gap-4">
                  <span className="font-medium">{o.title}</span>
                  <span className="text-lg">${(o.priceCents / 100).toFixed(2)}</span>
                </div>
                <p className="text-sm text-gray-600">
                  {TYPE_LABELS[o.type] ?? o.type} · delivered in {o.turnaroundDays} days ·{" "}
                  {o.revisionLimit} revision{o.revisionLimit === 1 ? "" : "s"} included
                </p>
                {o.description && <p className="mt-2 text-sm">{o.description}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {portfolio.length > 0 && (
        <section>
          <h2 className="text-xl font-medium mb-3">Recent work</h2>
          <ul className="flex flex-col gap-2">
            {portfolio.map((item) => (
              <li key={item.id} className="border rounded p-3">
                <a href={item.mediaUrl} target="_blank" rel="noopener noreferrer" className="underline break-all">
                  {item.caption ?? item.mediaUrl}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Verify** — `npm run build` clean AND the build output lists `/c/[handle]` as ISR/dynamic-with-revalidate (not `ƒ` forced-dynamic — if it shows forced dynamic, something imported the cookie client; fix before committing). Manual: live creator renders with offerings, "Verification pending" panel, portfolio links; a draft creator's handle and a nonsense handle both 404; unpublishing then revisiting (after revalidate) 404s.

- [ ] **Step 3: Commit**

```bash
git add app/c
git commit -m "feat: public creator storefront with ISR"
```

---

### Task 9: Real landing page

**Files:**
- Modify: `app/page.tsx` (replace boilerplate entirely), `app/layout.tsx` (metadata only: title "Clipline — book video creators", description "Book sponsored videos from vetted micro-influencers on YouTube, TikTok, and Instagram."; change nothing else in the file)

**Interfaces:**
- Consumes: nothing dynamic — fully static page, no Supabase imports.
- Produces: `/` — product landing with signup/login CTAs. Also the target of `requireRole` mismatches, so it must make sense to a logged-in user of the wrong role (neutral copy + both CTAs).

- [ ] **Step 1: Replace `app/page.tsx`**

```tsx
import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-3xl px-8 py-20">
      <h1 className="text-4xl font-semibold leading-tight mb-4">
        Book sponsored videos from micro-influencers — without the DM chaos.
      </h1>
      <p className="text-lg text-gray-600 mb-8">
        Creators list productized video offerings with transparent prices.
        Brands browse, book, and track delivery in one place. YouTube, TikTok,
        and Instagram Reels.
      </p>
      <div className="flex gap-4 mb-16">
        <Link href="/signup" className="bg-black text-white rounded px-5 py-3">
          Get started
        </Link>
        <Link href="/login" className="border rounded px-5 py-3">
          Log in
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        <section className="border rounded p-6">
          <h2 className="font-medium mb-2">For creators</h2>
          <p className="text-sm text-gray-600">
            A storefront that makes you look professional: set your prices,
            show verified audience stats, and manage every deal in one pipeline.
            Free — you keep 100% of your rate.
          </p>
        </section>
        <section className="border rounded p-6">
          <h2 className="font-medium mb-2">For brands</h2>
          <p className="text-sm text-gray-600">
            Find vetted video creators by niche, audience, and budget. Book a
            slot, share your brief, and approve the result — no spreadsheets,
            no ghosting.
          </p>
        </section>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Update metadata in `app/layout.tsx`** — replace the exported `metadata` object's `title` with `"Clipline — book video creators"` and `description` with `"Book sponsored videos from vetted micro-influencers on YouTube, TikTok, and Instagram."`. Touch nothing else.

- [ ] **Step 3: Verify** — `npm run build` clean, `/` prerendered static; manual: page renders, CTAs navigate.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx app/layout.tsx
git commit -m "feat: product landing page replacing boilerplate"
```

---

## Final fix wave (post-review, commit de4d927)

- `getStorefront` throws on query errors (transient failures never ISR-cache as 404/empty)
- `parseOptionalText` added: over-length optional text errors instead of silently wiping saved values (bio/country/description/caption)
- Migration 0008: public SELECT on portfolio_items/offerings gated to live creators
- `/c/[handle]` canonically redirects mixed-case URLs to lowercase

## Carry-forward (final-review triage)

- Deferred: WHATWG URL normalization in parseMediaUrl; suspended-owner toggle raw error; stale-id no-op shows "Saved"; currency display hardcoded $ (USD MVP); duplicate creatorHandle lookups (hoist to lib/storefront); proxy.ts could exclude /c/*; future display_name/avatar edit UI must revalidate storefronts
- Phase 3 prep: add creator_profiles.status index + niches GIN index with the discovery migration

### Task 10: Phase 2 verification sweep

**Files:**
- None created; runs checks and fixes only what they surface (report anything larger).

- [ ] **Step 1: Full local gate** — `npm test` (all green), `npm run lint` (exit 0), `npm run build` (clean; `/c/[handle]` ISR, `/` static).

- [ ] **Step 2: Advisors** — `npx supabase db advisors --local`: only the two triaged carry-forward findings remain (`security_definer_view` on public_creator_stats, `extension_in_public` citext). Anything new = fix or report.

- [ ] **Step 3: End-to-end walkthrough** (dev server + psql):
  1. Fresh creator signs up → dashboard shows 0/4 checklist
  2. Completes profile (handle `e2ecreator`), adds 1 offering + 1 portfolio link, publishes → 4/4
  3. Anonymous browser (or curl) loads `/c/e2ecreator` → 200 with offering + "verification pending"
  4. Brand account visits `/dashboard` → bounced to `/` which is now a real landing page
  5. Creator unpublishes → after revalidation `/c/e2ecreator` 404s
  6. Clean up test users: `delete from auth.users where email like '%@e2e.local';`

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "chore: phase 2 verification fixes"
```
(Skip the commit if the sweep changed nothing.)
