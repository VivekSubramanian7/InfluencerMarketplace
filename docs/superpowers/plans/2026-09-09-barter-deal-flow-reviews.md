# WS4 — Full Barter Deal Flow & Two-Sided Reviews Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the end-to-end barter deal flow agreed in the 2026-09-07 call — add the product-shipment steps (brand "product sent" in bulk → creator "product received" which starts the preview timer), re-add the brand's explicit "approve live link" verify step that was auto-completed away in migration `0026`, and make reviews genuinely two-sided (creator reviews brand as well as brand reviews creator). Also fix the TS/DB/test drift the audit found in the deal state machine.

**Architecture:** The deal state machine is defined in TypeScript (`lib/deals/machine.ts`) and mirrored into the `deal_transitions` table via `scripts/generate-transitions-sql.ts`. We add two barter statuses (`product_sent`, `product_received`) as an optional branch off `accepted` (non-barter deals still go `accepted → submit_preview` directly), re-introduce `published` as the state after `mark_published` with a brand `approve` → `completed` verify step, add a product-received preview timer to `run_deal_timers`, and add a `public_brand_reviews` view + brand-profile review surface so both directions are visible. Payment ("payment received/sent") remains an explicit **non-goal** per the call.

**Tech Stack:** Next.js 16.3.1 (Server Actions), Supabase (Postgres enums, RPCs, triggers), TypeScript, Vitest.

**Source audit:** verification round 2026-09-09. Confirmed: `mark_published → completed` via `0026`; `machine.test.ts` still expects `published` (drift); no barter/product symbols exist; reviews one-sided in public surface.

## Global Constraints

- **Migration numbers:** `0031` (enum additions — must be committed before use) and `0032` (transitions reseed + RPC + timer + reviews view). Assumes WS1/WS3/WS2 took `0028`–`0030`; use next free numbers otherwise.
- **Postgres enum rule:** new `deal_status` values added in `0031` cannot be referenced by functions/DML in the *same* migration — that is why the RPC/transition work is in `0032`.
- **The TypeScript machine is the source of truth**; regenerate the SQL seed with `pnpm gen:transitions` and commit the output. Never hand-edit generated transition rows.
- **Barter branch is opt-in:** only deals flagged barter (`payment_mode = 'barter'`) expose product steps; paid/other deals skip them.
- **Payment steps are out of scope** (documented non-goal).
- **DESIGN.md App register** for all deal UI. Run `pnpm test` and `pnpm build` before each commit.

---

## File Structure

- `lib/deals/machine.ts` — add `product_sent`, `product_received`, restore `published` post-publish + brand `approve`, add product transitions.
- `lib/deals/constants.ts` — labels + step ordering for new statuses.
- `lib/deals/ui-actions.ts` — affordances for `mark_product_sent`, `mark_product_received`, brand `approve` on `published`.
- `lib/deals/__tests__/machine.test.ts` / `ui-actions.test.ts` / `primary-action.test.ts` — update to new flow (fix drift).
- `scripts/generate-transitions-sql.ts` — unchanged logic; regenerate output.
- `supabase/migrations/0031_barter_enum.sql` — `alter type deal_status add value` for the two barter statuses.
- `supabase/migrations/0032_barter_flow_reviews.sql` — reseed `deal_transitions`, update `transition_deal` + `run_deal_timers`, add `product_received_at` column, add `public_brand_reviews` view + brand review RLS.
- `app/deals/[id]/actions.ts` / `app/deals/[id]/page.tsx` — wire new actions + brand approve button.
- `app/campaigns/[id]/bulk-proposals.tsx` or a new bulk deals control — brand bulk "Product sent".
- `app/c/[handle]/page.tsx` + brand profile page — display both review directions.
- `app/deals/[id]/review-actions.ts` — role-aware review target.

---

## Task 1: Fix state-machine drift and re-add brand "approve live link"

**Files:**
- Modify: `lib/deals/machine.ts:1-55`
- Modify: `lib/deals/ui-actions.ts`, `lib/deals/constants.ts`
- Modify tests: `lib/deals/__tests__/machine.test.ts`, `ui-actions.test.ts`, `primary-action.test.ts`

**Interfaces:**
- Produces (effective transitions for new deals):
  - `submitted --mark_published(creator)--> published` (NOT auto-complete)
  - `published --approve(brand)--> completed`
  - `published --auto_approve(system, 5d)--> completed` (kept)

- [ ] **Step 1: Update the tests first** to the intended flow (TDD): `machine.test.ts` asserts `mark_published` from `submitted` goes to `published` (creator), and `approve` from `published` goes to `completed` (brand). Keep the dispute/cancel cases.

- [ ] **Step 2: Run tests** — `pnpm test machine` → FAIL (current `machine.ts` sends `mark_published → completed`).

- [ ] **Step 3: Implement machine change** — in `lib/deals/machine.ts`, set `submitted --mark_published(creator)--> published`; ensure `published --approve(brand)--> completed` and `published --auto_approve(system)--> completed` exist. Update `ui-actions.ts` so `mark_published` label stays "Send live link" (creator) and `published` shows brand "Approve & complete"; update `constants.ts` `STATUS_LABELS`/`DEAL_STEPS`/`STATUS_TO_STEP` to include `published` as a real (non-legacy) step again.

- [ ] **Step 4: Run tests** — `pnpm test machine ui-actions primary-action` → PASS.

- [ ] **Step 5: Regenerate SQL seed** — `pnpm gen:transitions` and note the diff (used in Task 3's migration). Commit the machine/test changes now; the DB reseed lands in Task 3.

- [ ] **Step 6: Commit**

```bash
git add lib/deals/machine.ts lib/deals/ui-actions.ts lib/deals/constants.ts lib/deals/__tests__
git commit -m "fix(deals): re-add brand approve-live-link step; resolve state-machine drift"
```

---

## Task 2: Add barter product statuses to the machine

**Files:**
- Modify: `lib/deals/machine.ts`, `lib/deals/constants.ts`, `lib/deals/ui-actions.ts`
- Test: `lib/deals/__tests__/barter-flow.test.ts` (new)

**Interfaces:**
- Produces new transitions (barter branch):
  - `accepted --mark_product_sent(brand)--> product_sent`
  - `product_sent --mark_product_received(creator)--> product_received`
  - `product_received --submit_preview(creator)--> submitted`
  - non-barter unchanged: `accepted --submit_preview(creator)--> submitted`
- `DealAction` gains `"mark_product_sent" | "mark_product_received"`; `DealStatus` gains `"product_sent" | "product_received"`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/deals/__tests__/barter-flow.test.ts
import { describe, it, expect } from "vitest";
import { canTransition } from "../machine";

describe("barter product flow", () => {
  it("brand sends product from accepted", () => {
    expect(canTransition("accepted", "mark_product_sent", "brand")).toBe(true);
  });
  it("creator receives product, then submits preview", () => {
    expect(canTransition("product_sent", "mark_product_received", "creator")).toBe(true);
    expect(canTransition("product_received", "submit_preview", "creator")).toBe(true);
  });
  it("non-barter can still submit preview directly from accepted", () => {
    expect(canTransition("accepted", "submit_preview", "creator")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test** — `pnpm test barter-flow` → FAIL.

- [ ] **Step 3: Implement** — add the statuses/actions/transitions to `machine.ts`; add labels ("Product sent", "Product received") and step ordering to `constants.ts`; add affordances to `ui-actions.ts` (brand sees "Mark product sent" on `accepted` for barter deals; creator sees "Mark product received" on `product_sent`).

- [ ] **Step 4: Run test** — PASS.

- [ ] **Step 5: Regenerate seed** — `pnpm gen:transitions` (output feeds Task 3).

- [ ] **Step 6: Commit**

```bash
git add lib/deals/machine.ts lib/deals/constants.ts lib/deals/ui-actions.ts lib/deals/__tests__/barter-flow.test.ts
git commit -m "feat(deals): barter product-sent/received states in state machine"
```

---

## Task 3: Database — enum, transitions reseed, RPC payload, product-received column & timer

**Files:**
- Create: `supabase/migrations/0031_barter_enum.sql`
- Create: `supabase/migrations/0032_barter_flow_reviews.sql` (transitions + RPC + timer + column; reviews view added in Task 4 can be folded here or kept separate)
- Reference: `supabase/migrations/0026_auto_complete_on_publish.sql:6-8,15-116` (current `transition_deal`), `0024_unified_deal_flow.sql:289-324` (`run_deal_timers`)

**Interfaces:**
- Produces:
  - enum values `product_sent`, `product_received`.
  - `deals.product_received_at timestamptz`.
  - reseeded `deal_transitions` (from `pnpm gen:transitions` output) — including the restored `published` path and the new barter path.
  - `transition_deal` no longer forces `mark_published → completed`; sets `published_at` on `mark_published`, `product_received_at` on `mark_product_received`, `completed_at` on brand `approve`.
  - `run_deal_timers` adds a preview deadline based on `product_received_at` (barter deals) in addition to the existing 72h accept + 5d auto-approve.

- [ ] **Step 1: Enum migration**

```sql
-- supabase/migrations/0031_barter_enum.sql
alter type public.deal_status add value if not exists 'product_sent';
alter type public.deal_status add value if not exists 'product_received';
```

- [ ] **Step 2: Flow migration** (`0032`) — paste the regenerated `deal_transitions` seed (from `pnpm gen:transitions`) replacing the `0026` `UPDATE ... mark_published -> completed` behavior; add the column and updated functions:

```sql
-- supabase/migrations/0032_barter_flow_reviews.sql (excerpt)
alter table public.deals add column if not exists product_received_at timestamptz;

-- reseed transitions from generated output
truncate table public.deal_transitions;
-- <<< paste generated INSERT statements from `pnpm gen:transitions` here >>>

-- update transition_deal to set the right timestamps (base on 0026 body):
--   on mark_published: set published_at = now() (status -> published, NOT completed)
--   on approve (brand, from published): set completed_at = now()
--   on mark_product_received: set product_received_at = now()
--   preserve URL/payload guards (preview_url, live_url, revision_note, revision cap)
```
  (Copy the full `transition_deal` body from `0026` and apply only these targeted timestamp/target changes; keep `security definer set search_path = ''`.)

- [ ] **Step 3: Update `run_deal_timers`** — add: `product_received` + `product_received_at` older than the offering's preview window (default 3 days) → optional `expire_preview` handling (for now, just expose the deadline; do not auto-cancel unless a policy is set). Keep existing timers intact.

- [ ] **Step 4: Apply migrations locally** — `npx supabase migration up`; verify `deal_transitions` matches the TS machine (spot-check `submitted/mark_published/creator → published` and `published/approve/brand → completed`).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0031_barter_enum.sql supabase/migrations/0032_barter_flow_reviews.sql
git commit -m "feat(deals): barter enum + reseeded transitions + product-received timer"
```

---

## Task 4: Two-sided reviews

**Files:**
- Modify: `supabase/migrations/0032_barter_flow_reviews.sql` (append `public_brand_reviews` view + grants)
- Modify: `app/deals/[id]/review-actions.ts:25-47` (role-aware target + correct revalidate)
- Modify: `lib/storefront/queries.ts:54-63` (creator reviews unchanged) + add brand review query
- Modify: `app/c/[handle]/page.tsx:337-341` (label stays "Brand reviews") and brand profile page to show "Creator reviews of this brand"

**Interfaces:**
- Produces:
  - `public_brand_reviews` view: rows where `author_id = creator_id` (creator reviewing brand), joined to brand profile.
  - `review-actions.ts` submits a review whose `author_id` = current user; revalidates the counterparty's public page (creator storefront or brand profile) based on the author's role.

- [ ] **Step 1: Add the view** (in `0032`):

```sql
create or replace view public.public_brand_reviews as
select r.id, r.deal_id, d.brand_id, r.rating, r.body, r.created_at
from public.reviews r
join public.deals d on d.id = r.deal_id
where r.author_id = d.creator_id;   -- creator -> brand direction
grant select on public.public_brand_reviews to anon, authenticated;
```

- [ ] **Step 2: Write a failing test** for the review-target helper.

```ts
// app/deals/__tests__/review-target.test.ts
import { describe, it, expect } from "vitest";
import { reviewRevalidatePath } from "../../deals/[id]/review-target";
describe("reviewRevalidatePath", () => {
  it("brand author revalidates brand profile", () => {
    expect(reviewRevalidatePath("brand", "acme")).toBe("/brand/acme");
  });
  it("creator author revalidates creator storefront", () => {
    expect(reviewRevalidatePath("creator", "jane")).toBe("/c/jane");
  });
});
```

- [ ] **Step 3: Run test** — FAIL.

- [ ] **Step 4: Implement helper + wire** — create `app/deals/[id]/review-target.ts` with `reviewRevalidatePath(authorRole, handle)`; update `review-actions.ts` to revalidate the right page (currently always revalidates the creator storefront).

- [ ] **Step 5: Surface brand reviews** — add a brand review query reading `public_brand_reviews` and render a "Reviews from creators" section on the brand profile; keep the creator storefront's "Brand reviews" section.

- [ ] **Step 6: Run tests + build + manual verify** — after a completed deal, both parties can review; brand review shows on brand profile, creator review shows on storefront.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0032_barter_flow_reviews.sql app/deals/[id]/review-actions.ts app/deals/[id]/review-target.ts app/deals/__tests__/review-target.test.ts lib/storefront/queries.ts app/c/[handle]/page.tsx
git commit -m "feat(reviews): two-sided reviews with public_brand_reviews view + brand profile display"
```

---

## Task 5: Brand bulk "Product sent" + deal UI wiring

**Files:**
- Modify: `app/deals/[id]/actions.ts:13-16` (allow `mark_product_sent`, `mark_product_received` actions)
- Modify: `app/deals/[id]/page.tsx` (buttons for the new steps, gated on `payment_mode='barter'`)
- Create: bulk control — extend `app/campaigns/[id]/bulk-proposals.tsx` or add `app/deals/bulk-actions.ts` for "Product sent" across selected accepted barter deals.

**Interfaces:**
- Consumes: `transition_deal(p_deal_id, 'mark_product_sent'|'mark_product_received', role)`.
- Produces: brand can mark product sent (single + bulk across selected creators/deals); creator can mark product received; buttons use `SubmitButton` (WS5) to avoid double-submit.

- [ ] **Step 1: Allow the new actions** in the deal action allow-list (`actions.ts:13-16`).

- [ ] **Step 2: Add single-deal buttons** — on a barter deal in `accepted`, brand sees "Mark product sent"; in `product_sent`, creator sees "Mark product received". Use `lib/deals/ui-actions.ts` affordances so the UI stays declarative.

- [ ] **Step 3: Add bulk "Product sent"** — a form that iterates selected barter deals in `accepted` and calls `transition_deal(..., 'mark_product_sent', 'brand')` for each. Reuse the selection pattern.

- [ ] **Step 4: Add a smoke test** that the deal action allow-list includes the barter actions.

```ts
// app/deals/__tests__/barter-actions-allowed.test.ts
import { readFileSync } from "node:fs";
import { it, expect } from "vitest";
it("deal actions allow barter transitions", () => {
  const src = readFileSync("app/deals/[id]/actions.ts", "utf8");
  expect(src).toMatch(/mark_product_sent/);
  expect(src).toMatch(/mark_product_received/);
});
```

- [ ] **Step 5: Run test + build + manual verify** — full barter path: accept → product sent → product received → preview → approve/changes → live link → brand approve → completed → both review.

- [ ] **Step 6: Commit**

```bash
git add app/deals/[id]/actions.ts app/deals/[id]/page.tsx app/campaigns/[id]/bulk-proposals.tsx app/deals/__tests__/barter-actions-allowed.test.ts
git commit -m "feat(deals): brand product-sent (bulk) + creator product-received UI"
```

---

## Self-Review

1. **Coverage vs call:** product sent bulk (T5), product received + preview timer (T3/T5), preview + revision cap (already DONE), request changes/approve (DONE), live link (DONE), **brand approve live link re-added** (T1), close on approve (T1), two-sided reviews (T4). Payment steps documented as non-goal.
2. **Placeholders:** the one intentional insert point is the generated `deal_transitions` seed in `0032` — explicitly produced by `pnpm gen:transitions`, not a TODO.
3. **Type consistency:** `DealStatus`/`DealAction` additions (`product_sent`, `product_received`, `mark_product_sent`, `mark_product_received`) used consistently across machine, UI, actions, and DB; `published → approve → completed` consistent between TS and reseeded transitions.
4. **Enum ordering:** enum additions isolated in `0031` before use in `0032` — respects Postgres constraint.

## Execution Handoff

Plan saved. **(1) Subagent-Driven (recommended)** or **(2) Inline**. Strict order: T1 → T2 → (regenerate seed) → T3 → T4/T5. Best executed after WS5 so `SubmitButton` guards exist for the new buttons.
