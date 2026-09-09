# WS6 — Creator Gating (Storefront Completeness + Channel Match) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce the onboarding rule from the 2026-09-07 call: a creator may **view** campaigns freely, but may not **act** (apply to a campaign / accept an invite into a deal) until their storefront is complete — at least one connected channel, at least one offering, and at least one sample link — and, when applying, they must have an offering matching the campaign's required content format (already partly done) **and** a connected account on a required platform/channel.

**Architecture:** A single pure predicate `storefrontComplete(state)` builds on the existing `getOnboardingState()` (`lib/onboarding/state.ts`) which already counts connected accounts, offerings, and portfolio items. The apply/accept server actions and the campaign detail UI call this predicate; incomplete creators see a "Complete your storefront" recovery card instead of the apply form. The DB `validate_campaign_application_insert` trigger (`0023`) is extended to require a connected account and a portfolio item (defense in depth). Channel matching adds a check that the creator has a `connected_accounts` row on a platform the campaign targets.

**Tech Stack:** Next.js 16.3.1 (Server Actions), Supabase (Postgres triggers/RLS), TypeScript, Vitest.

**Source audit:** verification round 2026-09-09. Confirmed: creators can view campaigns (DONE, keep). Offering **format** match is enforced (UI+server+DB). Storefront completeness and platform/channel match are **GAP**. Publish currently allows unfinished storefronts ("You can publish with steps unfinished").

## Global Constraints

- **Next migration number:** `0033` (assumes `0028`–`0032` taken by WS1/WS3/WS2/WS4; use next free number otherwise).
- **Viewing stays open** — never gate campaign list/detail reads.
- **Format-match gate already exists** (`lib/campaigns/offering-match.ts`) — build alongside it, don't duplicate.
- Campaign `offering_type` is a **content format** enum; platform/channel is a separate concept on `connected_accounts.platform`. Channel matching requires a campaign to declare target platform(s); if the schema has none, add an optional `campaigns.platforms text[]` and only enforce when non-empty.
- **DESIGN.md App register** for the recovery UI. Run `pnpm test` and `pnpm build` before each commit.

---

## File Structure

- `lib/onboarding/completeness.ts` — `storefrontComplete(state)` predicate + `missingStorefrontItems(state)` + tests.
- `app/campaigns/[id]/actions.ts` — `applyToCampaign` gate on completeness + channel match.
- `app/inbox/actions.ts` — `respondInvite`/`accept_offer` gate on completeness (accept into a deal).
- `components/campaigns/campaign-detail.tsx` — recovery card when incomplete.
- `supabase/migrations/0033_apply_completeness_gate.sql` — extend `validate_campaign_application_insert`; optional `campaigns.platforms`.
- `lib/campaigns/channel-match.ts` — `creatorHasRequiredChannel()` pure helper + tests.

---

## Task 1: Storefront completeness predicate

**Files:**
- Create: `lib/onboarding/completeness.ts`
- Test: `lib/onboarding/__tests__/completeness.test.ts`
- Reference: `lib/onboarding/state.ts:9-27` (`getOnboardingState` returns counts)

**Interfaces:**
- Produces:

```ts
export interface StorefrontCounts { socialCount: number; offeringCount: number; portfolioCount: number; isLive: boolean; }
export function storefrontComplete(s: StorefrontCounts): boolean; // >=1 channel, >=1 offering, >=1 sample, live
export function missingStorefrontItems(s: StorefrontCounts): string[]; // human labels for what's missing
```

- [ ] **Step 1: Write the failing tests**

```ts
// lib/onboarding/__tests__/completeness.test.ts
import { describe, it, expect } from "vitest";
import { storefrontComplete, missingStorefrontItems } from "../completeness";

const full = { socialCount: 1, offeringCount: 1, portfolioCount: 1, isLive: true };

describe("storefrontComplete", () => {
  it("true when all present and live", () => {
    expect(storefrontComplete(full)).toBe(true);
  });
  it("false when a channel is missing", () => {
    expect(storefrontComplete({ ...full, socialCount: 0 })).toBe(false);
  });
  it("lists missing items", () => {
    expect(missingStorefrontItems({ ...full, offeringCount: 0, portfolioCount: 0 }))
      .toEqual(["an offering", "a sample link"]);
  });
});
```

- [ ] **Step 2: Run tests** — `pnpm test completeness` → FAIL.

- [ ] **Step 3: Implement**

```ts
// lib/onboarding/completeness.ts
export interface StorefrontCounts { socialCount: number; offeringCount: number; portfolioCount: number; isLive: boolean; }
export function storefrontComplete(s: StorefrontCounts): boolean {
  return s.socialCount >= 1 && s.offeringCount >= 1 && s.portfolioCount >= 1 && s.isLive;
}
export function missingStorefrontItems(s: StorefrontCounts): string[] {
  const missing: string[] = [];
  if (s.socialCount < 1) missing.push("a channel");
  if (s.offeringCount < 1) missing.push("an offering");
  if (s.portfolioCount < 1) missing.push("a sample link");
  if (!s.isLive) missing.push("a published storefront");
  return missing;
}
```

- [ ] **Step 4: Run tests** — PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/onboarding/completeness.ts lib/onboarding/__tests__/completeness.test.ts
git commit -m "feat(onboarding): storefront completeness predicate"
```

---

## Task 2: Channel-match helper + optional campaign platforms

**Files:**
- Create: `lib/campaigns/channel-match.ts`
- Test: `lib/campaigns/__tests__/channel-match.test.ts`
- Create: `supabase/migrations/0033_apply_completeness_gate.sql` (adds `campaigns.platforms text[]`, extends trigger — see Task 3)

**Interfaces:**
- Produces:

```ts
export function creatorHasRequiredChannel(
  creatorPlatforms: string[],
  requiredPlatforms: string[]
): boolean; // true if no requirement, or any overlap
```

- [ ] **Step 1: Write the failing test**

```ts
// lib/campaigns/__tests__/channel-match.test.ts
import { describe, it, expect } from "vitest";
import { creatorHasRequiredChannel } from "../channel-match";
describe("creatorHasRequiredChannel", () => {
  it("passes when no platform requirement", () => {
    expect(creatorHasRequiredChannel(["instagram"], [])).toBe(true);
  });
  it("passes on overlap", () => {
    expect(creatorHasRequiredChannel(["youtube","instagram"], ["instagram"])).toBe(true);
  });
  it("fails with no overlap", () => {
    expect(creatorHasRequiredChannel(["tiktok"], ["instagram"])).toBe(false);
  });
});
```

- [ ] **Step 2: Run test** — FAIL.

- [ ] **Step 3: Implement**

```ts
// lib/campaigns/channel-match.ts
export function creatorHasRequiredChannel(creatorPlatforms: string[], requiredPlatforms: string[]): boolean {
  if (requiredPlatforms.length === 0) return true;
  return requiredPlatforms.some((p) => creatorPlatforms.includes(p));
}
```

- [ ] **Step 4: Run test** — PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/campaigns/channel-match.ts lib/campaigns/__tests__/channel-match.test.ts
git commit -m "feat(campaigns): channel-match helper"
```

---

## Task 3: Gate apply — server + DB (completeness + channel)

**Files:**
- Modify: `app/campaigns/[id]/actions.ts:16-77` (`applyToCampaign`)
- Create/Modify: `supabase/migrations/0033_apply_completeness_gate.sql`
- Reference: `supabase/migrations/0023_feedback_fixes.sql:14-44` (`validate_campaign_application_insert`)

**Interfaces:**
- Consumes: `storefrontComplete`, `creatorHasRequiredChannel`, `getOnboardingState`.
- Produces: `applyToCampaign` redirects with a clear error when the storefront is incomplete or the required channel is missing (never for viewing); the DB trigger enforces the same completeness (connected account + portfolio item exist) as a backstop.

- [ ] **Step 1: Server gate** — in `applyToCampaign`, after confirming the creator profile, call `getOnboardingState` and `storefrontComplete`. If incomplete, `redirect(`/campaigns/${id}?error=` + encodeURIComponent("Complete your storefront (" + missing.join(", ") + ") before applying"))`. Then, if `campaign.platforms?.length`, fetch the creator's `connected_accounts.platform` list and enforce `creatorHasRequiredChannel`.

- [ ] **Step 2: Migration** — add optional platforms column and extend the trigger:

```sql
-- supabase/migrations/0033_apply_completeness_gate.sql
alter table public.campaigns add column if not exists platforms text[] not null default '{}';

create or replace function public.validate_campaign_application_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_camp public.campaigns;
  v_has_account boolean;
  v_has_portfolio boolean;
begin
  -- carry forward existing checks from 0023 verbatim (open, window, not own, matching active offering)
  -- ... existing checks ...

  select exists(select 1 from public.connected_accounts a where a.creator_id = new.creator_id) into v_has_account;
  select exists(select 1 from public.portfolio_items p where p.creator_id = new.creator_id) into v_has_portfolio;
  if not v_has_account or not v_has_portfolio then
    raise exception 'Storefront incomplete: add a channel and a sample before applying';
  end if;

  return new;
end;
$$;
```
  (Read `0023_feedback_fixes.sql:14-44` and reproduce its existing checks before the new block — do not drop them.)

- [ ] **Step 3: Add a guard test** ensuring the server action references completeness.

```ts
// app/campaigns/__tests__/apply-gate.test.ts
import { readFileSync } from "node:fs";
import { it, expect } from "vitest";
it("applyToCampaign gates on storefront completeness", () => {
  const src = readFileSync("app/campaigns/[id]/actions.ts", "utf8");
  expect(src).toMatch(/storefrontComplete/);
});
```

- [ ] **Step 4: Apply migration + run test + build** — `npx supabase migration up`; `pnpm test apply-gate`; `pnpm build`.

- [ ] **Step 5: Commit**

```bash
git add app/campaigns/[id]/actions.ts supabase/migrations/0033_apply_completeness_gate.sql app/campaigns/__tests__/apply-gate.test.ts
git commit -m "feat(campaigns): gate apply on storefront completeness + channel match"
```

---

## Task 4: Recovery UI on the campaign detail

**Files:**
- Modify: `components/campaigns/campaign-detail.tsx:388-411` (CreatorPanel)

**Interfaces:**
- Consumes: `storefrontComplete`, `missingStorefrontItems` (computed server-side and passed to the panel).
- Produces: when the creator's storefront is incomplete, the apply form is replaced by a card: "Complete your storefront to apply — missing: {list}" with a link to `/onboarding` (or `/dashboard`), consistent with the existing offering-type recovery card.

- [ ] **Step 1: Compute completeness server-side** in the campaign detail data load and pass `storefrontComplete` + `missingStorefrontItems` into `CreatorPanel`.

- [ ] **Step 2: Render the recovery card** when incomplete (reuse the styling of the existing offering-mismatch block at L392-410). Keep the campaign fully **viewable**.

- [ ] **Step 3: Manual verify** — an incomplete creator sees the recovery card, not the apply form, but can still read the campaign; a complete creator sees the apply form.

- [ ] **Step 4: Build + commit**

```bash
git add components/campaigns/campaign-detail.tsx
git commit -m "feat(campaigns): storefront-completeness recovery card on campaign detail"
```

---

## Task 5: Gate accept-into-deal (invites/offers)

**Files:**
- Modify: `app/inbox/actions.ts` (`respondInvite` accept path, and the offer-accept path `accept_offer`)

**Interfaces:**
- Produces: accepting an invite/offer that would start a deal also requires a complete storefront; otherwise redirect with the same completeness error. (Viewing/declining stays open.)

- [ ] **Step 1: Implement** — in `respondInvite` when `response === "accepted"`, and before `accept_offer`, compute completeness via `getOnboardingState`/`storefrontComplete`; if incomplete, redirect with the completeness error instead of proceeding.

- [ ] **Step 2: Add a guard test** analogous to Task 3.

```ts
// app/inbox/__tests__/accept-gate.test.ts
import { readFileSync } from "node:fs";
import { it, expect } from "vitest";
it("inbox accept path gates on completeness", () => {
  const src = readFileSync("app/inbox/actions.ts", "utf8");
  expect(src).toMatch(/storefrontComplete/);
});
```

- [ ] **Step 3: Run test + build + manual verify** — incomplete creator cannot accept into a deal; complete creator can.

- [ ] **Step 4: Commit**

```bash
git add app/inbox/actions.ts app/inbox/__tests__/accept-gate.test.ts
git commit -m "feat(inbox): gate accept-into-deal on storefront completeness"
```

---

## Self-Review

1. **Coverage vs call:** view allowed (unchanged), act blocked until ≥1 channel + ≥1 offering + sample links (T1,T3,T4,T5), channel/platform match on apply (T2,T3). Format match already existed and is preserved.
2. **Placeholders:** the only "carry forward" note is the existing `0023` trigger body — explicitly instructed to reproduce it, not a TODO.
3. **Type consistency:** `StorefrontCounts`, `storefrontComplete`, `missingStorefrontItems`, `creatorHasRequiredChannel` used consistently across server actions, UI, and tests.
4. **Migration:** `0033` assumed; `campaigns.platforms` defaults to `{}` so existing campaigns impose no channel requirement (safe).

## Execution Handoff

Plan saved. **(1) Subagent-Driven (recommended)** or **(2) Inline**. Order: T1, T2 (independent) → T3 → T4, T5. Depends on nothing else structurally, but the recovery UI (T4) shares files with WS5/WS3 edits to `campaign-detail.tsx` — sequence after those to avoid conflicts.
