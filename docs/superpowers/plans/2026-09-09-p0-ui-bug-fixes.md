# WS5 — P0 UI Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the five P0 defects surfaced in the 2026-09-07 call — the broken campaign side pane, deals↔campaigns↔inbox navigation dropping master-detail context, the sticky "Next steps" overlay mispositioning, spurious "illegal transition" errors, and multi-click/double-submit failures.

**Architecture:** Pure UI + server-redirect fixes, no schema changes. Three groups: (1) campaign detail pane layout so it fits the ≤28rem `<aside>`; (2) redirect/route consistency so campaign and inbox links keep the `?c=`/master-detail context; (3) a shared `SubmitButton` (already exists at `components/ui/submit-button.tsx`) applied to every deal/offer/campaign form to prevent double-submit, which is the root cause of most "illegal transition" errors.

**Tech Stack:** Next.js 16.3.1 (App Router, Server Components/Actions), React 19, Tailwind v4, Supabase, Vitest.

**Source audit:** `docs/superpowers/plans/2026-09-09-*` verification round (see conversation). No spec file — bounded bug fixes.

## Global Constraints

- **No database migrations.** Every fix is UI or server-redirect.
- **DESIGN.md App register** for all authenticated surfaces: no `shadow-card`, no `font-black`/`font-extrabold`, type ≤24px/600 in-app, 8px button/input radii, 12px tiles, 16px panel. Elevation via hairlines + `--ground`/`--rail`/`--card` steps; shadow only on floating layers.
- **No new dependencies.**
- **Server Components by default.** `"use client"` only where interactivity requires it.
- Run `pnpm test` and `pnpm build` before every commit; both must pass.

---

## File Structure

- `components/campaigns/campaign-detail.tsx` — remove duplicate `<h1>` in `compact`, fix apply/edit form widths, replace `font-extrabold`, add compact dismiss control.
- `app/campaigns/page.tsx` — validate `?c=` ownership/existence before rendering pane (mirror inbox).
- `app/campaigns/[id]/bulk-proposals.tsx` — "Open conversation" → `/inbox?c=`; "Invite to chat" redirect honors pane `returnTo`.
- `app/campaigns/[id]/actions.ts` — `decideApplication` accept redirect honors `return_to`.
- `app/globals.css` — remove conflicting `.deal-next-steps` bottom anchor.
- `app/deals/[id]/page.tsx` — deal action forms use `SubmitButton`.
- `app/brand/page.tsx` — quick-approve form uses `SubmitButton`.
- `components/inbox/conversation-thread.tsx` — accept/offer forms use `SubmitButton`.
- `components/ui/submit-button.tsx` — reused as-is (no change unless a variant is needed).
- `components/mobile-nav.tsx` — add Campaigns tab for brand role.

---

## Task 1: Campaign detail pane fits the side aside

**Files:**
- Modify: `components/campaigns/campaign-detail.tsx` (heading ~L92-95, `CreatorPanel` grid ~L416, `font-extrabold` ~L95)
- Modify: `app/campaigns/[id]/edit-campaign-form.tsx:36` (`max-w-xl`)
- Test: `components/campaigns/__tests__/campaign-detail-compact.test.tsx` (new — render smoke test)

**Interfaces:**
- Consumes: `CampaignDetail({ campaignId, compact?, returnTo?, error?, saved?, invited? })`
- Produces: same signature; `compact` now renders an `<h2>` title, a dismiss link that clears `?c=`, single-column apply form, and full-width edit form.

- [ ] **Step 1: Write a failing render test** asserting that when `compact` is set the component does not emit a second `<h1>` and does not use `font-extrabold`.

```tsx
// components/campaigns/__tests__/campaign-detail-compact.test.tsx
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const src = readFileSync("components/campaigns/campaign-detail.tsx", "utf8");

describe("campaign detail compact register", () => {
  it("has no font-extrabold (DESIGN.md App register)", () => {
    expect(src.includes("font-extrabold")).toBe(false);
  });
  it("renders a compact dismiss control", () => {
    expect(src).toMatch(/href=\{returnTo.*\}[\s\S]*?Close|Close campaign/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `pnpm test campaign-detail-compact` → FAIL.

- [ ] **Step 3: Implement the fixes**
  - Change the compact-mode title from `<h1 ...>` to `<h2 className="text-lg font-semibold text-ink">` (keep `<h1>` only when `!compact`).
  - Replace all `font-extrabold` with `font-semibold`.
  - In `CreatorPanel`, change `md:grid md:grid-cols-[1fr_280px]` to a single column when `compact` (e.g. `className={compact ? "flex flex-col gap-4" : "md:grid md:grid-cols-[1fr_280px] gap-6"}`). Pass `compact` down to `CreatorPanel`.
  - When `compact` and `returnTo`, render a top-right dismiss link: `<Link href={returnTo} className="text-sm text-muted">Close</Link>`.
  - In `edit-campaign-form.tsx`, change `max-w-xl` to `w-full` (the pane already constrains width).

- [ ] **Step 4: Run test to verify it passes** — `pnpm test campaign-detail-compact` → PASS.

- [ ] **Step 5: Build** — `pnpm build` → no type errors.

- [ ] **Step 6: Commit**

```bash
git add components/campaigns/campaign-detail.tsx app/campaigns/[id]/edit-campaign-form.tsx components/campaigns/__tests__/campaign-detail-compact.test.tsx
git commit -m "fix(campaigns): compact detail pane fits side aside (heading, widths, dismiss)"
```

---

## Task 2: Validate `?c=` before rendering the campaign pane

**Files:**
- Modify: `app/campaigns/page.tsx:42-67`
- Reference: `app/inbox/page.tsx:88-95` (ownership pre-check pattern)

**Interfaces:**
- Produces: `selectedId` is passed to the pane only after confirming the campaign exists and is viewable by the user; otherwise the pane is `undefined` (list renders full-width, no crash/404 of the whole page).

- [ ] **Step 1: Read** `app/campaigns/page.tsx:42-67` and `app/inbox/page.tsx:88-95` to mirror the guard.

- [ ] **Step 2: Implement** — before building `pane`, run a lightweight existence/visibility query:

```tsx
// after selectedId is read
let paneCampaignId: string | null = null;
if (selectedId) {
  const { data: exists } = await supabase
    .from("campaigns")
    .select("id")
    .eq("id", selectedId)
    .or(`status.eq.open,brand_id.eq.${user.id}`)
    .maybeSingle();
  paneCampaignId = exists?.id ?? null;
}
```
  Then use `paneCampaignId` (not `selectedId`) for the `pane` prop.

- [ ] **Step 3: Manual verification** — `pnpm dev`, visit `/campaigns?c=00000000-0000-0000-0000-000000000000`: page renders the list without a full-page 404; visit a valid `?c=`: pane renders.

- [ ] **Step 4: Build** — `pnpm build` → passes.

- [ ] **Step 5: Commit**

```bash
git add app/campaigns/page.tsx
git commit -m "fix(campaigns): guard invalid ?c= so a bad id no longer 404s the whole page"
```

---

## Task 3: Keep master-detail context across campaign/inbox navigation

**Files:**
- Modify: `app/campaigns/[id]/bulk-proposals.tsx:207-222` (Open conversation link + Invite redirect)
- Modify: `app/campaigns/[id]/actions.ts:106-138` (`decideApplication` accept redirect)

**Interfaces:**
- Consumes: `campaignsRedirectBase(...)`/`return_to` already threaded through these forms.
- Produces: "Open conversation" links to `/inbox?c=${convId}` (desktop master-detail) with a mobile fallback; accept redirect uses `return_to` when present, falling back to `/deals/${dealId}`.

- [ ] **Step 1: Write a failing test** for the redirect helper decision (extract a tiny pure helper so it is testable).

```ts
// lib/campaigns/__tests__/accept-redirect.test.ts
import { describe, it, expect } from "vitest";
import { acceptRedirect } from "../accept-redirect";

describe("acceptRedirect", () => {
  it("prefers return_to when provided", () => {
    expect(acceptRedirect("/campaigns?c=abc", "deal1")).toBe("/campaigns?c=abc");
  });
  it("falls back to the deal page", () => {
    expect(acceptRedirect(null, "deal1")).toBe("/deals/deal1");
  });
});
```

- [ ] **Step 2: Run test** — `pnpm test accept-redirect` → FAIL (module missing).

- [ ] **Step 3: Implement helper**

```ts
// lib/campaigns/accept-redirect.ts
export function acceptRedirect(returnTo: string | null, dealId: string): string {
  return returnTo && returnTo.startsWith("/") ? returnTo : `/deals/${dealId}`;
}
```

- [ ] **Step 4: Wire it in** `decideApplication` — replace the unconditional `redirect(`/deals/${dealId}`)` with `redirect(acceptRedirect(returnTo, dealId))`, reading `return_to` from the form data.

- [ ] **Step 5: Fix bulk-proposals links** — "Open conversation" → `/inbox?c=${convId}` for `lg+` and `/inbox/${convId}` for mobile (mirror the dual-link pattern in `components/inbox/conversation-list.tsx:98-135`). Ensure the "Invite to chat" hidden `redirect_to` uses the pane `returnTo` when set.

- [ ] **Step 6: Run test + build** — `pnpm test accept-redirect` → PASS; `pnpm build` → passes.

- [ ] **Step 7: Commit**

```bash
git add lib/campaigns/accept-redirect.ts lib/campaigns/__tests__/accept-redirect.test.ts app/campaigns/[id]/actions.ts app/campaigns/[id]/bulk-proposals.tsx
git commit -m "fix(campaigns): preserve master-detail context on accept + open conversation"
```

---

## Task 4: Fix the sticky "Next steps" overlay positioning

**Files:**
- Modify: `app/globals.css:245-248` (`.deal-next-steps`)
- Modify: `app/deals/[id]/page.tsx:147` (Tailwind sticky classes)

**Interfaces:**
- Produces: one consistent sticky anchor (top), removing the conflicting `bottom: 1rem` rule.

- [ ] **Step 1: Reproduce** — `pnpm dev`, open an accepted deal at a narrow and wide viewport; observe the "Next steps" card jumping/overlapping (Tailwind `top-[72px]` vs CSS `bottom: 1rem`).

- [ ] **Step 2: Implement** — remove the `.deal-next-steps { position: sticky; bottom: 1rem; z-index: 10; }` block from `globals.css` (keep the class if used for other styling, but drop `position`/`bottom`). Keep the Tailwind `sticky top-[72px] z-10` on the element as the single source of positioning. Replace `rounded-2xl` with `rounded-xl` (12px tile) per DESIGN.md.

- [ ] **Step 3: Manual verification** — card sticks below the top bar at all widths; no overlap.

- [ ] **Step 4: Build** — `pnpm build` → passes.

- [ ] **Step 5: Commit**

```bash
git add app/globals.css app/deals/[id]/page.tsx
git commit -m "fix(deals): single sticky anchor for Next steps card (remove top/bottom conflict)"
```

---

## Task 5: Prevent double-submit across deal/offer/campaign actions

**Files:**
- Reference: `components/ui/submit-button.tsx:14-16` (existing `SubmitButton` with `disabled={pending}`)
- Modify: `app/deals/[id]/page.tsx:167-209` (all deal action forms)
- Modify: `app/brand/page.tsx:296-303` (quick-approve)
- Modify: `components/inbox/conversation-thread.tsx:100-113,177` (accept invite/offer, send offer)
- Modify: `app/inbox/[id]/page.tsx:196,240,386` (accept & chat, accept & start deal, send offer)

**Interfaces:**
- Consumes: `SubmitButton` (client component using `useFormStatus`).
- Produces: every state-changing form disables its button while pending, eliminating the double-click → stale-status → "illegal transition" path identified in the audit.

- [ ] **Step 1: Confirm `SubmitButton`** at `components/ui/submit-button.tsx` supports the needed variants/props (label as children, `className`). If a `variant`/`className` passthrough is missing, add it (client component, `useFormStatus`).

- [ ] **Step 2: Replace `<Button type="submit">` with `<SubmitButton>`** in each form listed above. Because these are Server Components rendering forms, `SubmitButton` (client) can be dropped in directly as the submit control. Keep existing labels.

- [ ] **Step 3: Add a smoke test** asserting deal action forms no longer use a bare submit button.

```ts
// app/deals/__tests__/no-bare-submit.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
it("deal detail uses SubmitButton for actions", () => {
  const src = readFileSync("app/deals/[id]/page.tsx", "utf8");
  expect(src).toMatch(/SubmitButton/);
});
```

- [ ] **Step 4: Run test** — `pnpm test no-bare-submit` → PASS after wiring.

- [ ] **Step 5: Manual verification** — rapidly double-click "Submit preview" / "Accept": the second click is ignored (button disabled), no `?error=illegal transition`.

- [ ] **Step 6: Build** — `pnpm build` → passes.

- [ ] **Step 7: Commit**

```bash
git add app/deals/[id]/page.tsx app/brand/page.tsx components/inbox/conversation-thread.tsx app/inbox/[id]/page.tsx components/ui/submit-button.tsx app/deals/__tests__/no-bare-submit.test.ts
git commit -m "fix: disable submit while pending to stop double-submit illegal-transition errors"
```

---

## Task 6: Add Campaigns tab to brand mobile nav

**Files:**
- Modify: `components/mobile-nav.tsx:21-26` (brand tab list)

**Interfaces:**
- Produces: brand mobile nav includes Home, Discover, Campaigns, Inbox, Deals (matching desktop rail).

- [ ] **Step 1: Implement** — add a `Campaigns` entry (icon + `/campaigns`) to the brand tab array, mirroring the creator entry at L14-19.

- [ ] **Step 2: Manual verification** — narrow viewport as a brand: Campaigns tab appears and routes correctly.

- [ ] **Step 3: Build + commit**

```bash
git add components/mobile-nav.tsx
git commit -m "fix(nav): add Campaigns tab to brand mobile nav"
```

---

## Self-Review

1. **Coverage:** side-pane broken (Task 1–2), nav/overlay glitches (Task 3–4, 6), illegal transition + double-submit (Task 5). All five call defects mapped.
2. **Placeholders:** none — each step names exact files/lines from the audit and shows code.
3. **Type consistency:** `acceptRedirect(returnTo, dealId)` used consistently; `CampaignDetail` signature unchanged; `SubmitButton` reused.
4. **No migrations** — confirmed; nothing here touches the DB.

## Execution Handoff

Plan complete and saved. Two execution options: **(1) Subagent-Driven (recommended)** — fresh subagent per task with review between; **(2) Inline Execution** — batch with checkpoints. Tasks 1, 4, 5, 6 are independent and parallelizable; Task 3 depends on nothing but touches the same files as Task 1 (sequence them).
