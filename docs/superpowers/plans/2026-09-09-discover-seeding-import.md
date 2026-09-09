# WS7 — Discover Seeding & Handle→Stats Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give brands a populated Discover from day one, per the 2026-09-07 call: bulk-load ~1,000 existing influencer handles as browsable "seeded" (unclaimed) creators, build a reusable handle→stats import pipeline (followers, engagement) that admins can rerun for future batches, surface seeded creators in Discover as a list/table with follower + engagement columns, and let brands "invite to campaign" a seeded creator — which records an outreach task for admins to reach out and onboard that creator (since seeded creators have no auth account yet).

**Architecture:** Real creators live in `creator_profiles` (FK to `profiles`/auth users). Seeded creators have no auth account, so they live in a new `seeded_creators` table (handle, platform, stats, niches, country, source, `claimed_by`). A `discover_creators` view unions live creator profiles with unclaimed seeded rows so Discover renders both. A Node import script (service-role) upserts handles from CSV and enqueues them for enrichment; an enrichment function fills stats via the existing `lib/social` providers or an external scraper adapter. Inviting a seeded creator writes a `seed_outreach` row for the admin queue instead of creating a conversation.

**Tech Stack:** Next.js 16.3.1, Supabase (Postgres, service-role), TypeScript, Vitest, `tsx` for the script (already a devDependency).

**Source audit:** verification round 2026-09-09. Confirmed: Discover is a card grid using `searchCreators` over `creator_profiles` (status='live'); follower/engagement not shown; no bulk import exists; per-creator handle→stats sync exists only for authenticated creators (`register_social_account` + `lib/social/sync.ts`). The `2026-09-03-data-collection-design.md` doc is PostHog analytics, NOT a creator import pipeline.

## Global Constraints

- **Next migration number:** `0034` (assumes `0028`–`0033` taken by WS1/WS3/WS2/WS4/WS6; use next free number otherwise).
- **Seeded creators are unclaimed** — no auth user; never expose them as if they can log in. A `claimed_by` link lets a real signup adopt a seeded row (handle match).
- **Two use cases are distinct** (this was the recurring team misunderstanding): (a) the ~1,000 existing list = dummy/test data for *new* brands; (b) fresh 5–10k handles for the design partner. Both flow through the same `seeded_creators` table + import script; the difference is just the input CSV.
- **The actual scraping runs are ops** (Vivek). This plan delivers the ingestion path, enrichment adapter interface, and display — not the third-party scraper credentials.
- Import/enrichment run with the **service role** and must never be reachable from the browser.
- **DESIGN.md App register** for Discover. Run `pnpm test` and `pnpm build` before each commit.

---

## File Structure

- `supabase/migrations/0034_seeded_creators.sql` — `seeded_creators` table, `discover_creators` view, `seed_outreach` table, RLS/grants.
- `lib/discovery/seeded.ts` — types + `normalizeHandle()` + `mergeDiscoverRows()` pure helpers + tests.
- `lib/social/enrich.ts` — `EnrichmentProvider` interface + `enrichSeededCreator()` (wraps existing providers / external adapter).
- `scripts/import-seeded-creators.ts` — CSV → `seeded_creators` upsert (service role, `tsx`).
- `scripts/enrich-seeded-creators.ts` — batch enrichment runner.
- `lib/discovery/queries.ts` — read from `discover_creators` (union) and expose follower/engagement.
- `app/discover/page.tsx` + `components/discover/*` — list/table view with follower + engagement columns; invite-to-campaign on seeded rows creates outreach.
- `app/discover/actions.ts` — `requestSeedOutreach` action.

---

## Task 1: Seeded creators schema + discover view + outreach

**Files:**
- Create: `supabase/migrations/0034_seeded_creators.sql`
- Reference: `0001_profiles.sql:19-28` (creator_profiles), `0002_catalog.sql:46-60` (connected_accounts), `lib/discovery/queries.ts:4-16` (`CreatorCard`)

**Interfaces:**
- Produces:
  - `seeded_creators (id, handle, platform, display_name, bio, niches text[], country, follower_count, engagement_rate, avatar_url, sample_urls text[], source, claimed_by uuid null, created_at, enriched_at)` with `unique (platform, handle)`.
  - `seed_outreach (id, seeded_creator_id, brand_id, campaign_id null, status, created_at)`.
  - `discover_creators` view: union of (live `creator_profiles` projected to the card shape) and (unclaimed `seeded_creators`), with a `kind` discriminator (`'live' | 'seeded'`).

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0034_seeded_creators.sql
create table if not exists public.seeded_creators (
  id uuid primary key default gen_random_uuid(),
  handle text not null,
  platform text not null,
  display_name text,
  bio text,
  niches text[] not null default '{}',
  country text,
  follower_count bigint,
  engagement_rate numeric,
  avatar_url text,
  sample_urls text[] not null default '{}',
  source text not null default 'manual',
  claimed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  enriched_at timestamptz,
  unique (platform, handle)
);
alter table public.seeded_creators enable row level security;
-- readable by any authenticated user only when unclaimed (discovery)
create policy "seeded creators readable when unclaimed" on public.seeded_creators
  for select to authenticated using (claimed_by is null);

create table if not exists public.seed_outreach (
  id uuid primary key default gen_random_uuid(),
  seeded_creator_id uuid not null references public.seeded_creators(id) on delete cascade,
  brand_id uuid not null references public.profiles(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','contacted','joined','dismissed')),
  created_at timestamptz not null default now(),
  unique (seeded_creator_id, brand_id, campaign_id)
);
alter table public.seed_outreach enable row level security;
create policy "brand manages own outreach" on public.seed_outreach
  for all to authenticated using (brand_id = (select auth.uid())) with check (brand_id = (select auth.uid()));

-- unified discovery view
create or replace view public.discover_creators as
select
  'live'::text as kind,
  cp.id::text as id,
  cp.handle,
  cp.display_name,
  cp.bio,
  cp.niches,
  cp.country,
  ca.follower_count,
  ca.engagement_rate
from public.creator_profiles cp
left join lateral (
  select follower_count, engagement_rate from public.connected_accounts a
  where a.creator_id = cp.id order by follower_count desc nulls last limit 1
) ca on true
where cp.status = 'live'
union all
select
  'seeded'::text as kind,
  sc.id::text as id,
  sc.handle,
  sc.display_name,
  sc.bio,
  sc.niches,
  sc.country,
  sc.follower_count,
  sc.engagement_rate
from public.seeded_creators sc
where sc.claimed_by is null;

grant select on public.discover_creators to authenticated;
```

- [ ] **Step 2: Apply migration** — `npx supabase migration up`; confirm the view returns existing live creators (seeded empty for now).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0034_seeded_creators.sql
git commit -m "feat(discover): seeded_creators + seed_outreach + unified discover_creators view"
```

---

## Task 2: Import script (CSV → seeded_creators)

**Files:**
- Create: `scripts/import-seeded-creators.ts`
- Create: `lib/discovery/seeded.ts`
- Test: `lib/discovery/__tests__/seeded.test.ts`
- Add npm script: `package.json` → `"import:seeded": "tsx scripts/import-seeded-creators.ts"`

**Interfaces:**
- Produces:
  - `normalizeHandle(raw: string): string` — strips `@`, URL prefixes, lowercases.
  - `parseSeedRow(row: Record<string,string>): SeededInput` — maps CSV columns to a typed insert.
  - CLI: `tsx scripts/import-seeded-creators.ts <path.csv> [--source label]` upserts on `(platform, handle)`.

- [ ] **Step 1: Write failing tests**

```ts
// lib/discovery/__tests__/seeded.test.ts
import { describe, it, expect } from "vitest";
import { normalizeHandle, parseSeedRow } from "../seeded";

describe("normalizeHandle", () => {
  it("strips @ and url and lowercases", () => {
    expect(normalizeHandle("@Jane")).toBe("jane");
    expect(normalizeHandle("https://instagram.com/Jane/")).toBe("jane");
  });
});
describe("parseSeedRow", () => {
  it("maps columns", () => {
    const r = parseSeedRow({ handle: "@Jane", platform: "instagram", country: "IN", niches: "fashion;beauty" });
    expect(r).toMatchObject({ handle: "jane", platform: "instagram", country: "IN", niches: ["fashion","beauty"] });
  });
});
```

- [ ] **Step 2: Run tests** — `pnpm test seeded` → FAIL.

- [ ] **Step 3: Implement helpers**

```ts
// lib/discovery/seeded.ts
export interface SeededInput {
  handle: string; platform: string; display_name?: string; country?: string;
  niches: string[]; follower_count?: number; engagement_rate?: number; source?: string;
}
export function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^https?:\/\/[^/]+\//i, "").replace(/^@/, "").replace(/\/+$/,"").toLowerCase();
}
export function parseSeedRow(row: Record<string, string>): SeededInput {
  return {
    handle: normalizeHandle(row.handle ?? ""),
    platform: (row.platform ?? "instagram").toLowerCase(),
    display_name: row.display_name || undefined,
    country: row.country || undefined,
    niches: (row.niches ?? "").split(/[;,]/).map((s) => s.trim()).filter(Boolean),
    follower_count: row.follower_count ? Number(row.follower_count) : undefined,
    engagement_rate: row.engagement_rate ? Number(row.engagement_rate) : undefined,
  };
}
```

- [ ] **Step 4: Run tests** — PASS.

- [ ] **Step 5: Implement the CLI** — read CSV, `parseSeedRow` each line, upsert into `seeded_creators` via the service-role Supabase client (`SUPABASE_SERVICE_ROLE_KEY`), `onConflict: 'platform,handle'`. Log inserted/updated counts. Guard: refuse to run without the service-role env var.

- [ ] **Step 6: Add npm script** to `package.json`.

- [ ] **Step 7: Dry run** — create a 3-row sample CSV in a temp path, run `pnpm import:seeded ./tmp/sample.csv --source list-1000`, confirm rows appear and Discover view returns them.

- [ ] **Step 8: Commit**

```bash
git add scripts/import-seeded-creators.ts lib/discovery/seeded.ts lib/discovery/__tests__/seeded.test.ts package.json
git commit -m "feat(discover): CSV import for seeded creators"
```

---

## Task 3: Enrichment pipeline (handle→stats)

**Files:**
- Create: `lib/social/enrich.ts`
- Create: `scripts/enrich-seeded-creators.ts`
- Test: `lib/social/__tests__/enrich.test.ts`
- Reference: `lib/social/sync.ts:43-97` (existing per-creator sync), `lib/social/providers/*`

**Interfaces:**
- Produces:
  - `interface EnrichmentProvider { fetchStats(platform: string, handle: string): Promise<{ followerCount: number; engagementRate: number; avatarUrl?: string } | null>; }`
  - `enrichSeededCreator(row, provider): Promise<Partial<SeededInput>>` — pure orchestration, testable with a fake provider.
  - CLI: `tsx scripts/enrich-seeded-creators.ts [--limit N] [--platform instagram]` — pulls un-enriched rows (`enriched_at is null`), calls the provider, updates stats + `enriched_at`.

- [ ] **Step 1: Write failing test with a fake provider**

```ts
// lib/social/__tests__/enrich.test.ts
import { describe, it, expect } from "vitest";
import { enrichSeededCreator } from "../enrich";

const fake = { fetchStats: async () => ({ followerCount: 12000, engagementRate: 3.4 }) };

describe("enrichSeededCreator", () => {
  it("returns stat patch from provider", async () => {
    const patch = await enrichSeededCreator({ platform: "instagram", handle: "jane" }, fake);
    expect(patch).toMatchObject({ follower_count: 12000, engagement_rate: 3.4 });
  });
  it("returns empty patch when provider yields null", async () => {
    const patch = await enrichSeededCreator({ platform: "x", handle: "y" }, { fetchStats: async () => null });
    expect(patch).toEqual({});
  });
});
```

- [ ] **Step 2: Run test** — FAIL.

- [ ] **Step 3: Implement**

```ts
// lib/social/enrich.ts
import type { SeededInput } from "../discovery/seeded";
export interface EnrichmentProvider {
  fetchStats(platform: string, handle: string): Promise<{ followerCount: number; engagementRate: number; avatarUrl?: string } | null>;
}
export async function enrichSeededCreator(
  row: { platform: string; handle: string },
  provider: EnrichmentProvider
): Promise<Partial<SeededInput> & { avatar_url?: string }> {
  const stats = await provider.fetchStats(row.platform, row.handle);
  if (!stats) return {};
  return { follower_count: stats.followerCount, engagement_rate: stats.engagementRate, avatar_url: stats.avatarUrl };
}
```

- [ ] **Step 4: Run test** — PASS.

- [ ] **Step 5: Implement a concrete provider** — wrap the existing `lib/social/providers/*` where possible; otherwise add a thin external-scraper adapter behind the same interface (API key from env, e.g. `SCRAPER_API_KEY`). Keep the adapter isolated so the scraper vendor can change without touching callers.

- [ ] **Step 6: Implement the batch runner** — service-role client, select `enriched_at is null` rows (respect `--limit`), enrich each, update, set `enriched_at`. Rate-limit friendly (sequential + small delay).

- [ ] **Step 7: Commit**

```bash
git add lib/social/enrich.ts scripts/enrich-seeded-creators.ts lib/social/__tests__/enrich.test.ts
git commit -m "feat(discover): handle->stats enrichment pipeline with pluggable provider"
```

---

## Task 4: Discover list view with follower/engagement + invite-to-campaign on seeded

**Files:**
- Modify: `lib/discovery/queries.ts:4-33` (read `discover_creators`, add `kind`, `followerCount`, `engagementRate`)
- Modify: `app/discover/page.tsx:345-466` (list/table layout + new columns)
- Modify: `components/discover/*` (row rendering + seeded badge)
- Create: `app/discover/actions.ts` → `requestSeedOutreach`
- Modify: `lib/discovery/seeded.ts` → add `mergeDiscoverRows()` if any client merge is needed
- Test: `lib/discovery/__tests__/queries-shape.test.ts` (shape guard)

**Interfaces:**
- Consumes: `discover_creators` view.
- Produces: Discover renders a dense list/table (identity, niche, country, followers, engagement, min price, action) for both live and seeded creators; seeded rows show a "Not yet on platform" chip. "Invite to campaign" on a **live** creator uses WS3's `inviteToCampaign`; on a **seeded** creator it calls `requestSeedOutreach` (writes a `seed_outreach` row) and shows "We'll reach out to this creator."

- [ ] **Step 1: Update the query** — point `searchCreators` at `discover_creators`, select `kind`, `follower_count`, `engagement_rate`; extend `CreatorCard` with `kind`, `followerCount`, `engagementRate`.

- [ ] **Step 2: Shape guard test**

```ts
// lib/discovery/__tests__/queries-shape.test.ts
import { readFileSync } from "node:fs";
import { it, expect } from "vitest";
it("discovery reads unified view and exposes stats", () => {
  const src = readFileSync("lib/discovery/queries.ts", "utf8");
  expect(src).toMatch(/discover_creators/);
  expect(src).toMatch(/follower/);
});
```

- [ ] **Step 3: List/table UI** — replace the `card-grid` with a dense row list per DESIGN.md (or a responsive table on `lg+`), adding follower + engagement columns. Keep filters/pagination. Add the seeded chip.

- [ ] **Step 4: `requestSeedOutreach` action** — insert a `seed_outreach` row `(seeded_creator_id, brand_id, campaign_id?)`; upsert on the unique key; revalidate discover. Wire the seeded-row action button to it (with the live-campaign picker from WS3 to attach a `campaign_id`).

- [ ] **Step 5: Run tests + build + manual verify** — Discover shows live + seeded creators with stats; inviting a seeded creator records outreach; inviting a live creator uses the WS3 flow.

- [ ] **Step 6: Commit**

```bash
git add lib/discovery/queries.ts app/discover/page.tsx components/discover app/discover/actions.ts lib/discovery/__tests__/queries-shape.test.ts
git commit -m "feat(discover): list view with follower/engagement + seeded outreach"
```

---

## Task 5: Claim-on-signup (adopt a seeded row)

**Files:**
- Modify: `app/onboarding/socials/actions.ts:46-59` (after `register_social_account`)
- Create: SQL helper in `0034_seeded_creators.sql` (append) — `claim_seeded_creator(p_platform text, p_handle text)`

**Interfaces:**
- Produces: when a real creator registers a social handle that matches an unclaimed seeded row, set `seeded_creators.claimed_by = auth.uid()` so it drops out of the seeded side of the view (no duplicate in Discover).

- [ ] **Step 1: Add the claim function** (append to `0034`):

```sql
create or replace function public.claim_seeded_creator(p_platform text, p_handle text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.seeded_creators
    set claimed_by = auth.uid()
    where platform = lower(p_platform) and handle = lower(p_handle) and claimed_by is null;
end;
$$;
grant execute on function public.claim_seeded_creator(text, text) to authenticated;
```

- [ ] **Step 2: Call it** after a successful `register_social_account` in `app/onboarding/socials/actions.ts`, passing the normalized platform + handle.

- [ ] **Step 3: Manual verify** — seed a handle, sign up a creator with that handle, confirm the seeded row is claimed and Discover shows only the live profile.

- [ ] **Step 4: Build + commit**

```bash
git add supabase/migrations/0034_seeded_creators.sql app/onboarding/socials/actions.ts
git commit -m "feat(discover): claim seeded creator on matching signup"
```

---

## Self-Review

1. **Coverage vs call:** bulk-load ~1,000 handles (T2), reusable handle→stats pipeline for future batches (T3), Discover list view with follower/engagement (T4), invite a not-yet-onboarded creator → admin outreach (T4), and the two-use-cases distinction is baked into the `source` label + same table. Claim-on-signup (T5) prevents duplicates.
2. **Placeholders:** the enrichment provider's concrete vendor is intentionally behind an interface (`EnrichmentProvider`) — the interface + a working shape are defined; the vendor credential is ops, explicitly noted, not a code TODO.
3. **Type consistency:** `SeededInput`, `normalizeHandle`, `parseSeedRow`, `EnrichmentProvider`, `enrichSeededCreator`, `discover_creators`, `seed_outreach` used consistently across script, pipeline, view, and UI.
4. **Migration:** `0034` assumed; view is additive and safe for existing live creators.

## Execution Handoff

Plan saved. **(1) Subagent-Driven (recommended)** or **(2) Inline**. Order: T1 → T2 → T3 → T4 → T5. Depends on WS3 for the live-creator `inviteToCampaign` picker reused in T4.
