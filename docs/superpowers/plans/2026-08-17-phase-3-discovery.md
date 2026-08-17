# Phase 3: Brand Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Brands can find creators: a filterable, searchable, paginated directory at `/discover` with creator cards linking to storefronts — closing the "plumbing, not demand" gap from the research.

**Architecture:** `/discover` is an authenticated dynamic page (any logged-in user) reading via the cookie-free public client (it only surfaces public data). Filters arrive as GET searchParams parsed by a pure, unit-tested helper; search uses `pg_trgm` ILIKE matching (right-sized for MVP scale — spec defers dedicated search to ~100k creators); a new migration adds the trigram/status/niches indexes the Phase-2 final review called for.

**Tech Stack:** Existing stack; `pg_trgm` extension (installed into the `extensions` schema — advisor rule). No new npm dependencies.

**Spec:** `docs/superpowers/specs/2026-08-16-video-micro-influencer-marketplace-design.md` (discovery module; ADR-006 Postgres search decision).

## Global Constraints

- Local Supabase workflow as Phases 1-2 (`npx supabase migration up` / `db reset`; psql via docker exec; explicit grants pattern — though this phase adds no tables).
- Extensions install into the `extensions` schema, never `public` (advisor rule that citext already violates as a known carry-forward — do not add another).
- `/discover` requires login (`requireUser()` — brands AND creators may browse) but reads data ONLY through `createPublicClient()` from `@/lib/supabase/public` — RLS live-creator gating (migration 0008) does the visibility work; never query with the service role here.
- Search must only ever surface live creators' data (guaranteed by 0008 policies; keep the explicit `status = 'live'` filter in queries as defense in depth).
- Money filters: dollars in the URL (`min_price`, `max_price`), cents in queries — reuse `parsePriceCents` semantics but allow whole-dollar bounds via `parseIntInRange` (1..1,000,000) × 100.
- Offering types exactly `dedicated_video|integration|short_form_post|ugc_video`.
- Page size fixed at 12; page param 1-based; invalid params fall back to defaults, never error pages.
- Commit after every task; `npm test` / `npm run lint` / `npm run build` clean before each commit.

---

### Task 1: Migration 0009 — discovery indexes

**Files:**
- Create: `supabase/migrations/0009_discovery_indexes.sql`

**Interfaces:**
- Produces: `pg_trgm` in `extensions` schema; GIN trigram indexes on `creator_profiles.handle`/`bio`; btree on `creator_profiles(status)`; GIN on `creator_profiles.niches`. Task 3's queries rely on these staying index-assisted at scale; nothing else references them by name.

- [ ] **Step 1: Write the migration**

`supabase/migrations/0009_discovery_indexes.sql`:
```sql
-- Discovery search/filter indexes (Phase 2 final-review prep note).
-- pg_trgm goes into the extensions schema (advisor rule 0014).
create extension if not exists pg_trgm with schema extensions;

create index creator_profiles_status_idx on public.creator_profiles (status);
create index creator_profiles_niches_gin on public.creator_profiles using gin (niches);
create index creator_profiles_handle_trgm on public.creator_profiles
  using gin (handle extensions.gin_trgm_ops);
create index creator_profiles_bio_trgm on public.creator_profiles
  using gin (bio extensions.gin_trgm_ops);
```

NOTE for implementer: `handle` is citext — if the trigram index refuses citext directly, use `((handle)::text) extensions.gin_trgm_ops` for that index. Report which form applied.

- [ ] **Step 2: Apply** — `npx supabase migration up`. Expected: clean.

- [ ] **Step 3: Verify** — psql:
```sql
select count(*) from pg_indexes where schemaname='public'
  and indexname in ('creator_profiles_status_idx','creator_profiles_niches_gin',
                    'creator_profiles_handle_trgm','creator_profiles_bio_trgm');
```
Expected: 4. And `select extname, nspname from pg_extension e join pg_namespace n on e.extnamespace=n.oid where extname='pg_trgm';` → schema `extensions`. Then `npx supabase db advisors --local` — no NEW findings beyond the two triaged carry-forwards.

- [ ] **Step 4: Commit**

```bash
git add supabase
git commit -m "feat: discovery search indexes (pg_trgm, status, niches)"
```

---

### Task 2: Filter parsing (pure, TDD)

**Files:**
- Create: `lib/discovery/filters.ts`
- Test: `lib/discovery/__tests__/filters.test.ts`

**Interfaces:**
- Produces (consumed by Tasks 3-4):
  ```ts
  interface DiscoveryFilters {
    q: string | null;            // free text, trimmed, ≤80 chars, null if empty
    niche: string | null;        // single tag, lowercased, ≤30 chars
    country: string | null;      // ≤60 chars
    type: OfferingType | null;   // enum-validated
    minPriceCents: number | null;
    maxPriceCents: number | null; // swapped with min if inverted
    page: number;                // ≥1, default 1
  }
  parseDiscoveryFilters(params: Record<string, string | string[] | undefined>): DiscoveryFilters
  PAGE_SIZE = 12
  ```

- [ ] **Step 1: Write failing tests**

`lib/discovery/__tests__/filters.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseDiscoveryFilters, PAGE_SIZE } from "@/lib/discovery/filters";

describe("parseDiscoveryFilters", () => {
  it("defaults on empty params", () => {
    expect(parseDiscoveryFilters({})).toEqual({
      q: null, niche: null, country: null, type: null,
      minPriceCents: null, maxPriceCents: null, page: 1,
    });
  });

  it("parses and normalizes all fields", () => {
    const f = parseDiscoveryFilters({
      q: "  Tech reviews ", niche: " Gaming ", country: " Germany ",
      type: "dedicated_video", min_price: "50", max_price: "500", page: "3",
    });
    expect(f).toEqual({
      q: "Tech reviews", niche: "gaming", country: "Germany",
      type: "dedicated_video", minPriceCents: 5000, maxPriceCents: 50000, page: 3,
    });
  });

  it("rejects invalid values to defaults, never throws", () => {
    const f = parseDiscoveryFilters({
      q: "x".repeat(81), niche: "y".repeat(31), type: "bogus",
      min_price: "-5", max_price: "abc", page: "0",
    });
    expect(f).toEqual({
      q: null, niche: null, country: null, type: null,
      minPriceCents: null, maxPriceCents: null, page: 1,
    });
  });

  it("swaps inverted price bounds", () => {
    const f = parseDiscoveryFilters({ min_price: "500", max_price: "50" });
    expect(f.minPriceCents).toBe(5000);
    expect(f.maxPriceCents).toBe(50000);
  });

  it("takes the first value of array params", () => {
    expect(parseDiscoveryFilters({ q: ["a", "b"] }).q).toBe("a");
  });

  it("exports PAGE_SIZE 12", () => {
    expect(PAGE_SIZE).toBe(12);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run lib/discovery/__tests__/filters.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement**

`lib/discovery/filters.ts`:
```ts
export const PAGE_SIZE = 12;

const OFFERING_TYPES = ["dedicated_video", "integration", "short_form_post", "ugc_video"] as const;
export type OfferingType = (typeof OFFERING_TYPES)[number];

export interface DiscoveryFilters {
  q: string | null;
  niche: string | null;
  country: string | null;
  type: OfferingType | null;
  minPriceCents: number | null;
  maxPriceCents: number | null;
  page: number;
}

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

function text(v: string | string[] | undefined, maxLen: number): string | null {
  const t = first(v).trim();
  return t.length >= 1 && t.length <= maxLen ? t : null;
}

function wholeDollarsToCents(v: string | string[] | undefined): number | null {
  const s = first(v).trim();
  if (!/^\d+$/.test(s)) return null;
  const n = parseInt(s, 10);
  return n >= 1 && n <= 1_000_000 ? n * 100 : null;
}

export function parseDiscoveryFilters(
  params: Record<string, string | string[] | undefined>
): DiscoveryFilters {
  const rawType = first(params.type);
  const type = OFFERING_TYPES.includes(rawType as OfferingType)
    ? (rawType as OfferingType)
    : null;

  let minPriceCents = wholeDollarsToCents(params.min_price);
  let maxPriceCents = wholeDollarsToCents(params.max_price);
  if (minPriceCents !== null && maxPriceCents !== null && minPriceCents > maxPriceCents) {
    [minPriceCents, maxPriceCents] = [maxPriceCents, minPriceCents];
  }

  const rawPage = first(params.page);
  const page = /^\d+$/.test(rawPage) && parseInt(rawPage, 10) >= 1
    ? parseInt(rawPage, 10)
    : 1;

  return {
    q: text(params.q, 80),
    niche: text(params.niche, 30)?.toLowerCase() ?? null,
    country: text(params.country, 60),
    type,
    minPriceCents,
    maxPriceCents,
    page,
  };
}
```

- [ ] **Step 4: Run tests** — focused file PASS, then `npm test` all green.

- [ ] **Step 5: Commit**

```bash
git add lib/discovery
git commit -m "feat: discovery filter parsing with safe defaults"
```

---

### Task 3: Creator search query

**Files:**
- Create: `lib/discovery/queries.ts`

**Interfaces:**
- Consumes: `DiscoveryFilters`/`PAGE_SIZE` (Task 2), `createPublicClient()`.
- Produces (Task 4 renders this):
  ```ts
  interface CreatorCard {
    userId: string; handle: string; displayName: string | null;
    bio: string | null; niches: string[]; country: string | null;
    minPriceCents: number | null;   // cheapest active offering, null if none
    offeringCount: number;
  }
  searchCreators(filters: DiscoveryFilters):
    Promise<{ creators: CreatorCard[]; total: number; page: number; pageSize: number }>
  ```
- Errors: throws on query errors (same policy as `getStorefront` — never render fake-empty results).

- [ ] **Step 1: Implement**

`lib/discovery/queries.ts`:
```ts
import { createPublicClient } from "@/lib/supabase/public";
import { DiscoveryFilters, PAGE_SIZE } from "@/lib/discovery/filters";

export interface CreatorCard {
  userId: string;
  handle: string;
  displayName: string | null;
  bio: string | null;
  niches: string[];
  country: string | null;
  minPriceCents: number | null;
  offeringCount: number;
}

export async function searchCreators(filters: DiscoveryFilters): Promise<{
  creators: CreatorCard[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const supabase = createPublicClient();

  // Offering-level filters resolve to a creator-id allowlist first.
  let creatorIdAllowlist: string[] | null = null;
  if (filters.type || filters.minPriceCents !== null || filters.maxPriceCents !== null) {
    let oq = supabase.from("offerings").select("creator_id").eq("active", true);
    if (filters.type) oq = oq.eq("type", filters.type);
    if (filters.minPriceCents !== null) oq = oq.gte("price_cents", filters.minPriceCents);
    if (filters.maxPriceCents !== null) oq = oq.lte("price_cents", filters.maxPriceCents);
    const { data, error } = await oq;
    if (error) throw new Error("discovery offerings query failed: " + error.message);
    creatorIdAllowlist = [...new Set((data ?? []).map((r) => r.creator_id as string))];
    if (creatorIdAllowlist.length === 0) {
      return { creators: [], total: 0, page: filters.page, pageSize: PAGE_SIZE };
    }
  }

  let cq = supabase
    .from("creator_profiles")
    .select("user_id, handle, bio, niches, country", { count: "exact" })
    .eq("status", "live");
  if (creatorIdAllowlist) cq = cq.in("user_id", creatorIdAllowlist);
  if (filters.niche) cq = cq.contains("niches", [filters.niche]);
  if (filters.country) cq = cq.ilike("country", filters.country);
  if (filters.q) cq = cq.or(`handle.ilike.%${filters.q}%,bio.ilike.%${filters.q}%`);

  const from = (filters.page - 1) * PAGE_SIZE;
  const { data: rows, count, error } = await cq
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (error) throw new Error("discovery creators query failed: " + error.message);

  const ids = (rows ?? []).map((r) => r.user_id as string);
  if (ids.length === 0) {
    return { creators: [], total: count ?? 0, page: filters.page, pageSize: PAGE_SIZE };
  }

  const [{ data: profiles, error: pErr }, { data: offerings, error: oErr }] = await Promise.all([
    supabase.from("profiles").select("id, display_name").in("id", ids),
    supabase.from("offerings").select("creator_id, price_cents").eq("active", true).in("creator_id", ids),
  ]);
  if (pErr) throw new Error("discovery profiles query failed: " + pErr.message);
  if (oErr) throw new Error("discovery pricing query failed: " + oErr.message);

  const nameById = new Map((profiles ?? []).map((p) => [p.id as string, p.display_name as string | null]));
  const priceStats = new Map<string, { min: number; count: number }>();
  for (const o of offerings ?? []) {
    const cur = priceStats.get(o.creator_id as string);
    const price = o.price_cents as number;
    if (!cur) priceStats.set(o.creator_id as string, { min: price, count: 1 });
    else priceStats.set(o.creator_id as string, { min: Math.min(cur.min, price), count: cur.count + 1 });
  }

  return {
    creators: (rows ?? []).map((r) => ({
      userId: r.user_id as string,
      handle: r.handle as string,
      displayName: nameById.get(r.user_id as string) ?? null,
      bio: (r.bio as string | null),
      niches: (r.niches as string[] | null) ?? [],
      country: (r.country as string | null),
      minPriceCents: priceStats.get(r.user_id as string)?.min ?? null,
      offeringCount: priceStats.get(r.user_id as string)?.count ?? 0,
    })),
    total: count ?? 0,
    page: filters.page,
    pageSize: PAGE_SIZE,
  };
}
```

NOTE for implementer: `filters.q` is interpolated into a PostgREST `.or()` filter string. `parseDiscoveryFilters` caps it at 80 chars but does NOT strip PostgREST syntax characters (`,`, `(`, `)`, `.`). Sanitize at the query site: before building the `.or()`, strip those characters from a local copy of `q` (`const q = filters.q.replace(/[,().]/g, " ").trim()`; skip the `.or()` entirely if the result is empty). This is part of the task, not optional.

- [ ] **Step 2: Verify** — `npm run build` clean; `npm test` green (I/O glue — exercised end-to-end in Task 5).

- [ ] **Step 3: Commit**

```bash
git add lib/discovery/queries.ts
git commit -m "feat: creator search query with filters and pagination"
```

---

### Task 4: The `/discover` page

**Files:**
- Modify: `app/discover/page.tsx` (replace the Phase-1 placeholder entirely)

**Interfaces:**
- Consumes: `requireUser()`, `parseDiscoveryFilters`, `searchCreators`, `PAGE_SIZE`.
- Produces: the brand-facing directory — filter form (GET), result cards linking to `/c/[handle]`, prev/next pagination preserving filters. Phase 4's booking entry point is the storefront link on each card.

- [ ] **Step 1: Replace the page**

`app/discover/page.tsx`:
```tsx
import Link from "next/link";
import { requireUser } from "@/lib/auth/require";
import { parseDiscoveryFilters } from "@/lib/discovery/filters";
import { searchCreators } from "@/lib/discovery/queries";

const TYPE_LABELS: Record<string, string> = {
  dedicated_video: "Dedicated video",
  integration: "Integration (60-90s)",
  short_form_post: "Short-form post",
  ugc_video: "UGC video",
};

function pageHref(params: URLSearchParams, page: number): string {
  const next = new URLSearchParams(params);
  next.set("page", String(page));
  return `/discover?${next.toString()}`;
}

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser();
  const params = await searchParams;
  const filters = parseDiscoveryFilters(params);
  const { creators, total, page, pageSize } = await searchCreators(filters);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const flatParams = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    const val = Array.isArray(v) ? v[0] : v;
    if (val) flatParams.set(k, val);
  }

  return (
    <main className="mx-auto max-w-5xl p-8">
      <h1 className="text-2xl font-semibold mb-6">Find video creators</h1>

      <form method="get" className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6 mb-8">
        <input name="q" defaultValue={filters.q ?? ""} placeholder="Search creators"
          className="border rounded p-2 sm:col-span-2" />
        <input name="niche" defaultValue={filters.niche ?? ""} placeholder="Niche (e.g. gaming)"
          className="border rounded p-2" />
        <input name="country" defaultValue={filters.country ?? ""} placeholder="Country"
          className="border rounded p-2" />
        <select name="type" defaultValue={filters.type ?? ""} className="border rounded p-2">
          <option value="">Any format</option>
          {Object.entries(TYPE_LABELS).map(([v, label]) => (
            <option key={v} value={v}>{label}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <input name="min_price" defaultValue={filters.minPriceCents ? filters.minPriceCents / 100 : ""}
            placeholder="Min $" inputMode="numeric" className="border rounded p-2 w-full" />
          <input name="max_price" defaultValue={filters.maxPriceCents ? filters.maxPriceCents / 100 : ""}
            placeholder="Max $" inputMode="numeric" className="border rounded p-2 w-full" />
        </div>
        <button className="bg-black text-white rounded p-2 sm:col-span-3 lg:col-span-6">
          Search
        </button>
      </form>

      <p className="text-sm text-gray-600 mb-4">
        {total} creator{total === 1 ? "" : "s"} found
      </p>

      {creators.length === 0 ? (
        <div className="border rounded p-8 text-center text-gray-600">
          <p className="mb-2">No creators match those filters yet.</p>
          <Link className="underline" href="/discover">Clear filters</Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {creators.map((c) => (
            <li key={c.userId} className="border rounded p-5 flex flex-col gap-2">
              <div>
                <p className="font-medium">{c.displayName ?? `@${c.handle}`}</p>
                <p className="text-sm text-gray-600">
                  @{c.handle}{c.country ? ` · ${c.country}` : ""}
                </p>
              </div>
              {c.bio && <p className="text-sm line-clamp-3">{c.bio}</p>}
              {c.niches.length > 0 && (
                <p className="text-xs text-gray-500">{c.niches.slice(0, 4).join(" · ")}</p>
              )}
              <p className="text-sm mt-auto">
                {c.minPriceCents !== null
                  ? <>From <span className="font-medium">${(c.minPriceCents / 100).toFixed(0)}</span> · {c.offeringCount} offering{c.offeringCount === 1 ? "" : "s"}</>
                  : "No offerings listed"}
              </p>
              <Link href={`/c/${c.handle}`} className="border rounded text-center p-2 mt-1">
                View storefront
              </Link>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <nav className="flex justify-center gap-4 mt-8">
          {page > 1 && (
            <Link className="underline" href={pageHref(flatParams, page - 1)}>← Previous</Link>
          )}
          <span className="text-gray-600">Page {page} of {totalPages}</span>
          {page < totalPages && (
            <Link className="underline" href={pageHref(flatParams, page + 1)}>Next →</Link>
          )}
        </nav>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Verify** — `npm run build` clean; `npm test` green; `npm run lint` exit 0.

- [ ] **Step 3: Commit**

```bash
git add app/discover
git commit -m "feat: brand discovery directory with filters and pagination"
```

---

### Task 5: Phase 3 verification sweep

**Files:**
- None created; checks + seeded e2e.

- [ ] **Step 1: Full gate** — `npm test` / `npm run lint` / `npm run build` all clean.

- [ ] **Step 2: Advisors** — `npx supabase db advisors --local`: nothing new beyond the two triaged carry-forwards.

- [ ] **Step 3: Seeded e2e** (dev server + psql; create fixtures as postgres):
  1. Seed 3 live creators (auth users via GoTrue admin API with role creator, then creator_profiles rows) with distinct niches (`gaming`, `beauty`, `tech`), countries (Germany, US, US), and active offerings priced $50 / $250 / $900 with types `short_form_post` / `dedicated_video` / `integration`; one additional DRAFT creator with an offering (must never appear).
  2. Log in as a brand (browser javascript_tool) and exercise `/discover`:
     - no filters → 3 cards, draft creator absent
     - `?niche=gaming` → 1 card
     - `?country=US` → 2 cards
     - `?type=dedicated_video` → 1 card
     - `?min_price=100&max_price=1000` → 2 cards
     - `?q=<part of a bio>` → the matching card
     - `?q=)%2Cor(` (PostgREST syntax chars) → page renders (no 500), 0 or safe results
     - pagination: temporarily seed 10 more live creators via SQL loop → page 1 shows 12, page 2 shows the rest, Next/Previous preserve filters
  3. Logged-out `/discover` → bounced to `/login`.
  4. Clean up all fixtures (`delete from auth.users where email like '%@e2e3.local';`).

- [ ] **Step 4: Commit fixes** (only if the sweep changed something)

```bash
git add -A
git commit -m "chore: phase 3 verification fixes"
```
