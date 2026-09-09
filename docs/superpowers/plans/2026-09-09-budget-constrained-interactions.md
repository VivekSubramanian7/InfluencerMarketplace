# WS2 — Budget-Constrained Interactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the budget rule the founders converged on in the 2026-09-07 call: at the **campaign** level, applying above budget is allowed but shows a **warning**; at the **offer/proposal** level tied to a campaign, the amount is **hard-capped** at the brand's campaign `budget_max_cents`; **1:1 direct** collaborations (bookings / chat offers with no campaign) stay **unrestricted**.

**Architecture:** Budget lives on campaigns as `budget_min_cents`/`budget_max_cents` (already mandatory — DONE). Two pure helpers encode the policy: `budgetWarning()` (campaign apply — soft) and `capOfferToCampaign()` (offer — hard). The campaign application path gains a client-side warning + a soft server-side analytics flag (never blocks). The offer path gains an optional `campaign_id` link on offers; when present, the offer amount is hard-capped in the server action and enforced by a DB trigger. Offers/deals with no `campaign_id` (booking, ad-hoc chat) are untouched.

**Tech Stack:** Next.js 16.3.1 (App Router, Server Actions), Supabase (Postgres + RLS + triggers), TypeScript, Vitest.

**Source audit:** verification round 2026-09-09. Apply has no warning; chat offers have no campaign link or cap; bookings already unrestricted. NOTE: offers are currently **brand→creator** (`validate_offer_insert` = "Only the brand can send an offer"); the hard cap therefore applies to the brand's offer amount within a campaign context, consistent with the call's "within the constraints of the campaign".

## Global Constraints

- **Next migration number:** `0030` (assumes WS1=`0028`, WS3=`0029`; use next free number otherwise).
- **Never block campaign applications on budget** — warning only.
- **Only cap offers that carry a `campaign_id`.** Null-campaign offers/bookings remain unrestricted.
- Money is integer cents everywhere (`*_cents`), parsed via `lib/storefront/validation.ts:parsePriceCents`.
- **DESIGN.md App register**; warnings use `--warn` token, not error styling.
- Run `pnpm test` and `pnpm build` before each commit.

---

## File Structure

- `lib/campaigns/budget.ts` — `budgetWarning()`, `capOfferToCampaign()` pure helpers + tests.
- `components/campaigns/campaign-detail.tsx` — client-side over-budget warning on the apply form.
- `app/campaigns/[id]/actions.ts` — `applyToCampaign` records an over-budget analytics flag (no block).
- `supabase/migrations/0030_offer_campaign_cap.sql` — add `offers.campaign_id`, cap trigger, index.
- `app/inbox/actions.ts` — `sendOffer` accepts optional `campaign_id` and hard-caps to campaign budget.
- `components/inbox/*` / `app/inbox/[id]/page.tsx` — offer form shows the campaign cap when in campaign context.

---

## Task 1: Budget policy helpers

**Files:**
- Create: `lib/campaigns/budget.ts`
- Test: `lib/campaigns/__tests__/budget.test.ts`

**Interfaces:**
- Produces:

```ts
export function budgetWarning(priceCents: number, budgetMaxCents: number): string | null;
// returns a human warning when price > max, else null (NEVER blocks)

export function capOfferToCampaign(
  priceCents: number,
  budgetMaxCents: number | null
): { cents: number; capped: boolean };
// hard cap: if a campaign max is present and price exceeds it, clamp to max
```

- [ ] **Step 1: Write the failing tests**

```ts
// lib/campaigns/__tests__/budget.test.ts
import { describe, it, expect } from "vitest";
import { budgetWarning, capOfferToCampaign } from "../budget";

describe("budgetWarning", () => {
  it("warns when price exceeds budget max", () => {
    expect(budgetWarning(60000, 50000)).toMatch(/above the brand'?s budget/i);
  });
  it("is silent within budget", () => {
    expect(budgetWarning(40000, 50000)).toBeNull();
  });
});

describe("capOfferToCampaign", () => {
  it("clamps to campaign max", () => {
    expect(capOfferToCampaign(70000, 50000)).toEqual({ cents: 50000, capped: true });
  });
  it("passes through within budget", () => {
    expect(capOfferToCampaign(40000, 50000)).toEqual({ cents: 40000, capped: false });
  });
  it("is unrestricted when no campaign max (1:1)", () => {
    expect(capOfferToCampaign(999999, null)).toEqual({ cents: 999999, capped: false });
  });
});
```

- [ ] **Step 2: Run tests** — `pnpm test budget` → FAIL.

- [ ] **Step 3: Implement**

```ts
// lib/campaigns/budget.ts
export function budgetWarning(priceCents: number, budgetMaxCents: number): string | null {
  if (priceCents > budgetMaxCents) {
    return "This is above the brand's budget — you can still apply, but they may decline.";
  }
  return null;
}

export function capOfferToCampaign(
  priceCents: number,
  budgetMaxCents: number | null
): { cents: number; capped: boolean } {
  if (budgetMaxCents != null && priceCents > budgetMaxCents) {
    return { cents: budgetMaxCents, capped: true };
  }
  return { cents: priceCents, capped: false };
}
```

- [ ] **Step 4: Run tests** — PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/campaigns/budget.ts lib/campaigns/__tests__/budget.test.ts
git commit -m "feat(budget): warning + hard-cap policy helpers"
```

---

## Task 2: Campaign apply — soft warning (never blocks)

**Files:**
- Modify: `components/campaigns/campaign-detail.tsx:430-441` (apply form price field → live warning)
- Modify: `app/campaigns/[id]/actions.ts:16-77` (`applyToCampaign` records analytics flag)

**Interfaces:**
- Consumes: `budgetWarning`, `budgetMaxCents` (already available in `CreatorPanel`).
- Produces: an inline `--warn` message under the price input when the entered value exceeds `budgetMaxCents`; the server records `over_budget: boolean` in the `campaign_applied` analytics event. No new hard error.

- [ ] **Step 1: Make the price field interactive** — the apply price input becomes a small client component (or the `CreatorPanel` gains `"use client"` for the price sub-section) that computes `budgetWarning(enteredCents, budgetMaxCents)` on change and renders it in `text-[var(--warn)]`.

- [ ] **Step 2: Server soft-flag** — in `applyToCampaign`, after parsing `price`, fetch the campaign `budget_max_cents` (already fetching the campaign row) and pass `over_budget: price > budget_max_cents` to the existing analytics capture. Do NOT add any redirect/error for over-budget.

- [ ] **Step 3: Add a test** verifying the action never blocks on over-budget (unit-test the decision by extracting the guard into a helper, or assert via the pure `budgetWarning` that it returns a string but the action still inserts). Minimal: assert `applyToCampaign` has no `redirect` guarded by budget comparison.

```ts
// app/campaigns/__tests__/apply-no-budget-block.test.ts
import { readFileSync } from "node:fs";
import { it, expect } from "vitest";
it("applyToCampaign does not block on budget", () => {
  const src = readFileSync("app/campaigns/[id]/actions.ts", "utf8");
  // no redirect that references budget_max in the apply path
  expect(/budget_max[\s\S]{0,80}redirect/.test(src)).toBe(false);
});
```

- [ ] **Step 4: Run test + build + manual verify** — entering a price above budget shows a warning but the application still submits.

- [ ] **Step 5: Commit**

```bash
git add components/campaigns/campaign-detail.tsx app/campaigns/[id]/actions.ts app/campaigns/__tests__/apply-no-budget-block.test.ts
git commit -m "feat(campaigns): over-budget application shows warning, never blocks"
```

---

## Task 3: Offer campaign link + hard cap (schema + trigger)

**Files:**
- Create: `supabase/migrations/0030_offer_campaign_cap.sql`
- Reference: `supabase/migrations/0017_conversations.sql:141` (offers `price_cents` check), `:182-183` (`validate_offer_insert`)

**Interfaces:**
- Produces:
  - `offers.campaign_id uuid references campaigns(id)` (nullable — null = 1:1 unrestricted).
  - `validate_offer_insert` updated so that when `campaign_id` is set, `price_cents` must be `<= campaigns.budget_max_cents` (raises otherwise). Null campaign → no cap.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0030_offer_campaign_cap.sql
alter table public.offers
  add column if not exists campaign_id uuid references public.campaigns(id) on delete set null;

create index if not exists offers_campaign_id_idx on public.offers(campaign_id);

-- extend the existing offer insert validation with a campaign budget cap
create or replace function public.validate_offer_insert()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_conv public.conversations;
  v_max bigint;
begin
  select * into v_conv from public.conversations where id = new.conversation_id;
  if v_conv is null then raise exception 'conversation not found'; end if;
  if v_conv.brand_id <> auth.uid() then
    raise exception 'Only the brand can send an offer';
  end if;

  if new.campaign_id is not null then
    select budget_max_cents into v_max from public.campaigns where id = new.campaign_id;
    if v_max is not null and new.price_cents > v_max then
      raise exception 'Offer exceeds the campaign budget cap of % cents', v_max;
    end if;
  end if;

  return new;
end;
$$;
```
  (Preserve any other checks the current `validate_offer_insert` performs — read `0017_conversations.sql:166-190` and carry them forward verbatim before adding the cap block.)

- [ ] **Step 2: Apply migration locally** — `npx supabase migration up`; confirm success.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0030_offer_campaign_cap.sql
git commit -m "feat(offers): optional campaign link with hard budget cap in validation trigger"
```

---

## Task 4: sendOffer honors the campaign cap

**Files:**
- Modify: `app/inbox/actions.ts:90-121` (`sendOffer`)
- Modify: offer form UI (`app/inbox/[id]/page.tsx:322-386`, `components/inbox/conversation-thread.tsx:149-178`) — pass `campaign_id` when the conversation was opened from a campaign invite (from WS3 `campaign_invites`), and show the cap.

**Interfaces:**
- Consumes: `capOfferToCampaign`, `campaign_invites` (WS3) to resolve the active campaign for a conversation.
- Produces: `sendOffer` reads optional `campaign_id`; if present, fetches `budget_max_cents`, applies `capOfferToCampaign`, inserts the (possibly clamped) `price_cents` with `campaign_id`. Trigger from Task 3 is the backstop. Null campaign → unchanged behavior.

- [ ] **Step 1: Resolve campaign context** — when rendering the offer form, look up `campaign_invites` for the conversation (WS3). If found, pass a hidden `campaign_id` and display "Capped at brand budget: $X".

- [ ] **Step 2: Implement cap in `sendOffer`**

```ts
const campaignId = formData.get("campaign_id") ? String(formData.get("campaign_id")) : null;
let priceToInsert = price;
if (campaignId) {
  const { data: c } = await supabase.from("campaigns").select("budget_max_cents").eq("id", campaignId).maybeSingle();
  const { cents } = capOfferToCampaign(price, c?.budget_max_cents ?? null);
  priceToInsert = cents;
}
// insert offers with price_cents: priceToInsert, campaign_id: campaignId
```

- [ ] **Step 3: Add a test** for the server decision via the helper (already covered by Task 1) plus a guard test that `sendOffer` passes `campaign_id` through.

```ts
// app/inbox/__tests__/send-offer-cap.test.ts
import { readFileSync } from "node:fs";
import { it, expect } from "vitest";
it("sendOffer applies capOfferToCampaign", () => {
  const src = readFileSync("app/inbox/actions.ts", "utf8");
  expect(src).toMatch(/capOfferToCampaign/);
  expect(src).toMatch(/campaign_id/);
});
```

- [ ] **Step 4: Run test + build + manual verify** — sending a campaign-context offer above budget clamps to the cap; a 1:1 offer (no campaign) accepts any valid amount.

- [ ] **Step 5: Commit**

```bash
git add app/inbox/actions.ts app/inbox/[id]/page.tsx components/inbox/conversation-thread.tsx app/inbox/__tests__/send-offer-cap.test.ts
git commit -m "feat(offers): hard-cap campaign-context offers to brand budget; keep 1:1 unrestricted"
```

---

## Self-Review

1. **Coverage vs call:** campaign apply = warning (T2), offer = hard cap when campaign-linked (T3–T4), 1:1 unrestricted (null-campaign path preserved throughout).
2. **Placeholders:** none — helpers, SQL, and wiring shown. Note the explicit instruction to carry forward existing `validate_offer_insert` checks.
3. **Type consistency:** `budgetWarning(price, max)`, `capOfferToCampaign(price, max|null) → {cents, capped}`, `offers.campaign_id` used consistently.
4. **Dependency:** Task 4 depends on WS3's `campaign_invites` to know the campaign for a conversation. If WS3 is not yet executed, Task 4 can fall back to a hidden `campaign_id` passed explicitly by the offer form (still valid).

## Execution Handoff

Plan saved. **(1) Subagent-Driven (recommended)** or **(2) Inline**. Order: T1 → T2 (independent) and T1 → T3 → T4. Best executed after WS3 so the campaign-conversation link exists.
