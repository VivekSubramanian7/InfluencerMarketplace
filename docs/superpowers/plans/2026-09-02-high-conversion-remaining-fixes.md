# High-Conversion Remaining Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining gaps from the UI/UX high-conversion checklist audit that were not addressed in commit `95a7a0e`.

**Architecture:** Next.js 16 App Router (server components by default; small client components only where interactivity is required). Supabase for data. Tailwind v4 with the "Gallery Frame" token system in `app/globals.css`. Pure logic goes in `lib/` with colocated `__tests__` (vitest); UI is verified via `npm run lint` + `npm run build`.

**Tech Stack:** Next.js 16.3, React 19, TypeScript, Tailwind v4, Supabase JS, vitest.

## Global Constraints

- **Design system is law:** Follow `DESIGN.md` ("Gallery Frame"). Warm near-white `#FAF9F6`, ink `#1B1917`, ink pill CTAs, `shadow-card`. **Amber `#C9962B` is the trust voice only** (ratings, Verified, deadlines/urgency) — never decorative. No new gradients in chrome, no dark mode.
- **Never fabricate data.** All numbers/badges must come from real rows. `DESIGN.md` explicitly forbids fake metrics.
- **Tabular numerals** (`tabular-nums`) on every price, count, metric, and countdown.
- **Accessibility:** WCAG AA, labels on inputs, visible focus, 44px targets, honor `prefers-reduced-motion`.
- **Verification per task:** `npm run lint` (0 errors), `npm run build` (exit 0), `npm test` (all pass) before each commit.
- **Existing reusable components:** `components/ui/confirm-submit-button.tsx` (`ConfirmSubmitButton`), `components/ui/button.tsx` (`Button`), `components/ui/badge.tsx` (`Badge`).
- Branch: `feat/deal-flow-optimization`. Commit after each task.

---

## File Structure

**New files**
- `lib/deals/deadlines.ts` — pure deadline math + countdown formatting (Task 1).
- `lib/deals/__tests__/deadlines.test.ts` — unit tests for the above (Task 1).
- `components/deals/deadline-countdown.tsx` — client ticking countdown chip (Task 2).

**Modified files**
- `app/deals/[id]/page.tsx` — surface the active deadline (Task 2).
- `app/c/[handle]/page.tsx` — rating/Verified beside the creator H1 (Task 3); price in sticky "Book now" (Task 4).
- `app/brand/onboarding/page.tsx` + `components/brand/onboarding-wizard.tsx` — echo persisted goals (Task 5).
- `app/discover/page.tsx` — confirm-guard the saved-search delete (Task 6).
- `app/campaigns/[id]/page.tsx` — smart-default the creator pitch (Task 7).
- `app/brand/page.tsx` — power-user metrics variant (Task 8).
- `app/(auth)/signup/page.tsx` — remove unused import (Task 9).

**Deferred (see final section):** value anchoring / compare-at pricing.

---

### Task 1: Deal deadline helper (pure logic + tests)

**Files:**
- Create: `lib/deals/deadlines.ts`
- Test: `lib/deals/__tests__/deadlines.test.ts`

**Interfaces:**
- Produces:
  - `ACCEPT_WINDOW_MS: number`, `AUTO_APPROVE_WINDOW_MS: number`
  - `addMs(iso: string, ms: number): string` — ISO string N ms after `iso`
  - `msRemaining(deadlineIso: string, now?: number): number`
  - `formatRemaining(ms: number): string` — e.g. `"2d 3h"`, `"5h 12m"`, `"14m"`, `"0m"`

- [ ] **Step 1: Write the failing test**

```typescript
// lib/deals/__tests__/deadlines.test.ts
import { describe, it, expect } from "vitest";
import {
  ACCEPT_WINDOW_MS,
  AUTO_APPROVE_WINDOW_MS,
  addMs,
  msRemaining,
  formatRemaining,
} from "@/lib/deals/deadlines";

describe("deal deadlines", () => {
  it("window constants match the spec (72h accept, 5-day auto-approve)", () => {
    expect(ACCEPT_WINDOW_MS).toBe(72 * 60 * 60 * 1000);
    expect(AUTO_APPROVE_WINDOW_MS).toBe(5 * 24 * 60 * 60 * 1000);
  });

  it("addMs offsets an ISO timestamp", () => {
    expect(addMs("2026-01-01T00:00:00.000Z", 60_000)).toBe("2026-01-01T00:01:00.000Z");
  });

  it("msRemaining is positive before and negative after the deadline", () => {
    const now = Date.parse("2026-01-01T00:00:00.000Z");
    expect(msRemaining("2026-01-01T01:00:00.000Z", now)).toBe(3_600_000);
    expect(msRemaining("2025-12-31T23:00:00.000Z", now)).toBe(-3_600_000);
  });

  it("formatRemaining renders coarse-to-fine buckets and clamps at zero", () => {
    expect(formatRemaining(-5)).toBe("0m");
    expect(formatRemaining(0)).toBe("0m");
    expect(formatRemaining(14 * 60_000)).toBe("14m");
    expect(formatRemaining((5 * 60 + 12) * 60_000)).toBe("5h 12m");
    expect(formatRemaining((2 * 24 * 60 + 3 * 60) * 60_000)).toBe("2d 3h");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/deals/__tests__/deadlines.test.ts`
Expected: FAIL — `Cannot find module '@/lib/deals/deadlines'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/deals/deadlines.ts
// Pure deadline math for anti-ghosting timers (see supabase/migrations/0011_deal_timers.sql):
// 72h to accept a requested/funded deal; 5 days after publish before auto-approve.
export const ACCEPT_WINDOW_MS = 72 * 60 * 60 * 1000;
export const AUTO_APPROVE_WINDOW_MS = 5 * 24 * 60 * 60 * 1000;

export function addMs(iso: string, ms: number): string {
  return new Date(new Date(iso).getTime() + ms).toISOString();
}

export function msRemaining(deadlineIso: string, now: number = Date.now()): number {
  return new Date(deadlineIso).getTime() - now;
}

export function formatRemaining(ms: number): string {
  if (ms <= 0) return "0m";
  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/deals/__tests__/deadlines.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/deals/deadlines.ts lib/deals/__tests__/deadlines.test.ts
git commit -m "feat(deals): add pure deadline math + countdown formatting"
```

---

### Task 2: Live deadline countdown on the deal page

**Files:**
- Create: `components/deals/deadline-countdown.tsx`
- Modify: `app/deals/[id]/page.tsx`

**Interfaces:**
- Consumes: `msRemaining`, `formatRemaining` from `lib/deals/deadlines` (Task 1).
- Produces: `DeadlineCountdown` React component — props `{ deadlineIso: string; label: string }`.

**Context:** `app/deals/[id]/page.tsx` already fetches `deal` (has `requested_at`, `status`) and `events` (has `action`, `created_at`). The status→step map and the status banner render around lines 137–148. Insert the countdown right after that banner. Deadlines: status `requested`/`funded` → `addMs(deal.requested_at, ACCEPT_WINDOW_MS)`; status `published` → `addMs(<mark_published event created_at>, AUTO_APPROVE_WINDOW_MS)`.

- [ ] **Step 1: Create the client countdown component**

```tsx
// components/deals/deadline-countdown.tsx
"use client";

import { useEffect, useState } from "react";
import { msRemaining, formatRemaining } from "@/lib/deals/deadlines";

/**
 * Amber urgency chip that recomputes every 60s. Amber is the trust/urgency
 * voice per DESIGN.md. Text-only updates, so prefers-reduced-motion is a no-op.
 */
export function DeadlineCountdown({
  deadlineIso,
  label,
}: {
  deadlineIso: string;
  label: string;
}) {
  const [ms, setMs] = useState(() => msRemaining(deadlineIso));

  useEffect(() => {
    setMs(msRemaining(deadlineIso));
    const t = setInterval(() => setMs(msRemaining(deadlineIso)), 60_000);
    return () => clearInterval(t);
  }, [deadlineIso]);

  const overdue = ms <= 0;
  return (
    <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber bg-amber/10 px-4 py-2.5 text-sm">
      <span aria-hidden className="size-2 shrink-0 rounded-full bg-amber" />
      <span className="font-medium">
        {label}{" "}
        <span className="font-bold tabular-nums text-amber-foreground">
          {overdue ? "any moment now" : formatRemaining(ms)}
        </span>
        {!overdue && <span className="text-muted-foreground"> left</span>}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Import into the deal page**

In `app/deals/[id]/page.tsx`, add to the import block (after the `StarRating` import near line 15):

```tsx
import { DeadlineCountdown } from "@/components/deals/deadline-countdown";
import { addMs, ACCEPT_WINDOW_MS, AUTO_APPROVE_WINDOW_MS } from "@/lib/deals/deadlines";
```

- [ ] **Step 3: Compute the active deadline (server side)**

In `app/deals/[id]/page.tsx`, immediately after `const currentStep = STATUS_TO_STEP[deal.status] ?? 0;` (near line 86) add:

```tsx
  let deadline: { iso: string; label: string } | null = null;
  if (deal.status === "requested" || deal.status === "funded") {
    deadline = {
      iso: addMs(deal.requested_at as string, ACCEPT_WINDOW_MS),
      label: "Creator has",
    };
  } else if (deal.status === "published") {
    const publishedAt = (events ?? []).find((e) => e.action === "mark_published")?.created_at;
    if (publishedAt) {
      deadline = {
        iso: addMs(publishedAt as string, AUTO_APPROVE_WINDOW_MS),
        label: "Auto-approves in",
      };
    }
  }
```

- [ ] **Step 4: Render the countdown after the status banner**

In `app/deals/[id]/page.tsx`, find the status banner block that ends with:

```tsx
        <span className="font-semibold">{STATUS_LABELS[deal.status] ?? deal.status}</span>
      </div>
```

Immediately after that closing `</div>`, add:

```tsx
      {deadline && (
        <DeadlineCountdown deadlineIso={deadline.iso} label={deadline.label} />
      )}
```

- [ ] **Step 5: Verify build + lint + tests**

Run: `npm run lint && npm run build && npm test`
Expected: lint 0 errors, build exit 0, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add app/deals/[id]/page.tsx components/deals/deadline-countdown.tsx
git commit -m "feat(deals): surface live accept/auto-approve countdown (loss aversion)"
```

---

### Task 3: Rating + Verified beside the storefront creator name (trust proximity)

**Files:**
- Modify: `app/c/[handle]/page.tsx`

**Context:** The storefront currently shows rating/Verified in an absolutely-positioned badge at the banner's top-right (`absolute right-6 top-6 ...`), detached from the `<h1>` creator name. The checklist wants trust signals adjacent to the title. The page already computes `avgRating`, `ratingCount`, and `stats` (each with `verificationStatus`). Keep the floating badge OR remove it — this task adds an inline trust row directly under the H1 so the signal sits with the title.

- [ ] **Step 1: Add an inline trust row under the H1**

In `app/c/[handle]/page.tsx`, find the creator name heading:

```tsx
          <h1 className="mt-5 text-[clamp(1.9rem,4.5vw,3rem)] font-black leading-tight">
            {profile.displayName ?? `@${profile.handle}`}
          </h1>
```

Immediately after the closing `</h1>`, insert:

```tsx
          {(avgRating !== null || stats.some((s) => s.verificationStatus === "verified")) && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              {avgRating !== null && (
                <span className="font-semibold">
                  <span className="text-amber">★</span> {avgRating}
                  <span className="ml-1 font-normal text-white/80 tabular-nums">
                    ({ratingCount} review{ratingCount === 1 ? "" : "s"})
                  </span>
                </span>
              )}
              {stats.some((s) => s.verificationStatus === "verified") && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-white/95 px-2 py-0.5 text-[12px] font-semibold text-foreground">
                  <span aria-hidden>✓</span> Verified
                </span>
              )}
            </div>
          )}
```

> Note: The H1 sits on the creator gradient banner (light text). The rating text uses `text-white/80` for the count; the Verified chip stays a solid white chip (per DESIGN.md: white proof-badge text must sit in a solid chip, never raw on gradient). If the H1 in this file is NOT on the gradient banner, use `text-muted-foreground` for the count and `bg-amber/15 text-amber-foreground` for the chip instead — check the surrounding `style={{ background: ... }}` context before choosing.

- [ ] **Step 2: Verify build + lint**

Run: `npm run lint && npm run build`
Expected: lint 0 errors, build exit 0.

- [ ] **Step 3: Manual check**

Run `npm run dev`, open a creator storefront that has reviews and a verified stat, confirm the ★ rating + review count + Verified chip appear directly under the name and are legible on the gradient.

- [ ] **Step 4: Commit**

```bash
git add app/c/[handle]/page.tsx
git commit -m "feat(storefront): rating + Verified adjacent to creator name (trust proximity)"
```

---

### Task 4: Price inside the storefront sticky "Book now" CTA

**Files:**
- Modify: `app/c/[handle]/page.tsx`

**Context:** The mobile sticky CTA renders `cheapest` (fields `title`, `priceCents`, `turnaroundDays`, `id`). The summary shows "From $X" but the button text is a generic "Book now". Embed the price in the button (checklist: dynamic action button pricing).

- [ ] **Step 1: Add price to the sticky button**

In `app/c/[handle]/page.tsx`, find:

```tsx
                  <a href={`/book/${cheapest.id}`}>Book now</a>
```

Replace with:

```tsx
                  <a href={`/book/${cheapest.id}`}>
                    Book · ${(cheapest.priceCents / 100).toFixed(0)}
                  </a>
```

- [ ] **Step 2: Verify build + lint**

Run: `npm run lint && npm run build`
Expected: lint 0 errors, build exit 0.

- [ ] **Step 3: Commit**

```bash
git add app/c/[handle]/page.tsx
git commit -m "feat(storefront): embed price in sticky Book CTA (dynamic action pricing)"
```

---

### Task 5: Use the persisted signup goals in onboarding (close the IKEA loop)

**Files:**
- Modify: `app/brand/onboarding/page.tsx`
- Modify: `components/brand/onboarding-wizard.tsx`

**Context:** Commit `95a7a0e` stores `goals` on the auth user (`options.data.goals` in `app/(auth)/actions.ts`). Nothing reads them yet. Read them server-side in brand onboarding and echo them back so the user sees their pre-signup effort preserved. `app/brand/onboarding/page.tsx` already creates a Supabase server client and passes props to `OnboardingWizard`.

**Interfaces:**
- Produces: `OnboardingWizard` gains an optional prop `goals?: string[]`.

- [ ] **Step 1: Read goals in the onboarding page**

In `app/brand/onboarding/page.tsx`, after the existing Supabase user/auth fetch (where a server client already exists), add a read of the auth user's metadata. If the file does not already fetch the user, add:

```tsx
  const { data: { user } } = await supabase.auth.getUser();
  const goals = Array.isArray(user?.user_metadata?.goals)
    ? (user!.user_metadata!.goals as string[]).slice(0, 8)
    : [];
```

Then pass it into the wizard render:

```tsx
      <OnboardingWizard
        defaults={defaults}
        proposal={proposal}
        website={website}
        productsJson={productsJson}
        goals={goals}
      />
```

(Match the existing prop list; only add `goals={goals}`.)

- [ ] **Step 2: Accept and echo the prop in the wizard**

In `components/brand/onboarding-wizard.tsx`, extend the props type and destructure:

```tsx
export function OnboardingWizard({
  defaults,
  proposal,
  website,
  productsJson,
  goals = [],
}: {
  defaults: BrandProfileDefaults | null;
  proposal: IngestProposal | null;
  website: string | null;
  productsJson: string | null;
  goals?: string[];
}) {
```

Then, inside the top-level `<div>` return, immediately AFTER the progress-bar segments block (the `<div className="mt-1.5 flex gap-1"> ... </div>`), add:

```tsx
      {goals.length > 0 && (
        <p className="mt-3 rounded-lg border border-ok/30 bg-ok/5 px-4 py-2.5 text-sm text-ok">
          Tailoring your setup for:{" "}
          <span className="font-semibold">{goals.join(", ")}</span>
        </p>
      )}
```

- [ ] **Step 3: Verify build + lint**

Run: `npm run lint && npm run build`
Expected: lint 0 errors, build exit 0.

- [ ] **Step 4: Commit**

```bash
git add app/brand/onboarding/page.tsx components/brand/onboarding-wizard.tsx
git commit -m "feat(onboarding): echo persisted signup goals (IKEA effect)"
```

---

### Task 6: Confirm-guard the saved-search delete

**Files:**
- Modify: `app/discover/page.tsx`

**Context:** Saved-search delete is a one-click `×` (`<form action={deleteSearch}>`). This is a small destructive action; swap the raw `×` button for the existing `ConfirmSubmitButton` two-step guard for consistency with offering deletion.

- [ ] **Step 1: Import the guard**

In `app/discover/page.tsx` imports, add:

```tsx
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
```

- [ ] **Step 2: Replace the one-click delete**

Find:

```tsx
                <form action={deleteSearch}>
                  <input type="hidden" name="id" value={s.id} />
                  <button
                    type="submit"
                    aria-label={`Delete saved search ${s.name}`}
                    className="grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    ×
                  </button>
                </form>
```

Replace with:

```tsx
                <form action={deleteSearch}>
                  <input type="hidden" name="id" value={s.id} />
                  <ConfirmSubmitButton label="Remove" confirmLabel="Remove for good" />
                </form>
```

- [ ] **Step 3: Verify build + lint**

Run: `npm run lint && npm run build`
Expected: lint 0 errors, build exit 0.

- [ ] **Step 4: Commit**

```bash
git add app/discover/page.tsx
git commit -m "feat(discover): confirm-guard saved-search deletion"
```

---

### Task 7: Smart-default the creator campaign pitch

**Files:**
- Modify: `app/campaigns/[id]/page.tsx`

**Context:** In `CreatorPanel`, the price is already prefilled from the budget midpoint (commit `95a7a0e`). The `pitch` textarea is still placeholder-only. Add a lightweight scaffold `defaultValue` derived from the campaign so the creator edits rather than starts blank (smart default / combat blank-page fatigue). `CreatorPanel` already receives `budgetMinCents`/`budgetMaxCents`; pass the campaign `title` and `offering_type` label too.

**Interfaces:**
- Produces: `CreatorPanel` gains props `campaignTitle: string` and `offeringLabel: string`.

- [ ] **Step 1: Pass the new props at the call site**

In `app/campaigns/[id]/page.tsx`, find the `<CreatorPanel ... />` render and add:

```tsx
            campaignTitle={campaign.title}
            offeringLabel={TYPE_LABELS[campaign.offering_type] ?? campaign.offering_type}
```

- [ ] **Step 2: Accept the props**

Extend the `CreatorPanel` signature:

```tsx
async function CreatorPanel({
  campaignId,
  open,
  userId,
  budgetMinCents,
  budgetMaxCents,
  campaignTitle,
  offeringLabel,
  supabase,
}: {
  campaignId: string;
  open: boolean;
  userId: string;
  budgetMinCents: number;
  budgetMaxCents: number;
  campaignTitle: string;
  offeringLabel: string;
  supabase: Supabase;
}) {
```

- [ ] **Step 3: Prefill the pitch textarea**

Find the pitch `Textarea` in `CreatorPanel`:

```tsx
          <Textarea
            id="pitch"
            name="pitch"
            rows={5}
            required
            placeholder="Why you're the right creator for this: your angle, your audience, relevant work."
          />
```

Replace with:

```tsx
          <Textarea
            id="pitch"
            name="pitch"
            rows={5}
            required
            defaultValue={`Hi! I'd love to work on "${campaignTitle}". As a ${offeringLabel.toLowerCase()} creator, my angle would be:\n\n- \n\nMy audience: \nRelevant work: `}
          />
          <p className="text-xs text-muted-foreground">
            Starter draft — make it yours before sending.
          </p>
```

- [ ] **Step 4: Verify build + lint**

Run: `npm run lint && npm run build`
Expected: lint 0 errors, build exit 0.

- [ ] **Step 5: Commit**

```bash
git add app/campaigns/[id]/page.tsx
git commit -m "feat(campaigns): scaffold creator pitch as a smart default"
```

---

### Task 8: Power-user metrics variant on the brand dashboard (adaptive layout)

**Files:**
- Modify: `app/brand/page.tsx`

**Context:** `app/brand/page.tsx` shows the same layout to all onboarded brands (a getting-started checklist until `allDone`, then stats + deals). Add a dense "power user" summary strip for brands with a meaningful history (>= 3 completed deals), shown above the deals list. Reuse whatever completed-deal data the page already loads; if a completed-count is not already computed, derive it from the deals the page fetches. Do NOT add fabricated metrics — only count/sum real rows.

- [ ] **Step 1: Compute a power-user flag from existing data**

In `app/brand/page.tsx`, after the deals data is fetched (locate the variable holding the brand's deals; commonly `deals` or `recentDeals`), add:

```tsx
  const completedDeals = (deals ?? []).filter((d) => d.status === "completed");
  const isPowerUser = completedDeals.length >= 3;
  const totalCompletedCents = completedDeals.reduce(
    (sum, d) => sum + (d.price_cents ?? 0),
    0
  );
```

> If the page's deal query does not select `status` and `price_cents`, extend that `.select(...)` to include them. Verify the exact variable name and select columns before editing.

- [ ] **Step 2: Render a dense metrics strip for power users**

Immediately before the deals list section (the block that maps over deals), add:

```tsx
        {isPowerUser && (
          <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-card p-4 shadow-card">
              <p className="text-xs font-medium text-muted-foreground">Completed deals</p>
              <p className="mt-1 text-2xl font-black tabular-nums">
                {completedDeals.length}
              </p>
            </div>
            <div className="rounded-2xl bg-card p-4 shadow-card">
              <p className="text-xs font-medium text-muted-foreground">Total booked</p>
              <p className="mt-1 text-2xl font-black tabular-nums">
                ${Math.round(totalCompletedCents / 100).toLocaleString("en-US")}
              </p>
            </div>
            <div className="rounded-2xl bg-card p-4 shadow-card">
              <p className="text-xs font-medium text-muted-foreground">Active deals</p>
              <p className="mt-1 text-2xl font-black tabular-nums">
                {(deals ?? []).filter((d) =>
                  !["completed", "cancelled"].includes(d.status)
                ).length}
              </p>
            </div>
          </section>
        )}
```

- [ ] **Step 3: Verify build + lint**

Run: `npm run lint && npm run build`
Expected: lint 0 errors, build exit 0.

- [ ] **Step 4: Manual check**

With a brand account that has >= 3 completed deals, confirm the metrics strip appears; with a new brand, confirm it does NOT (only the getting-started checklist shows).

- [ ] **Step 5: Commit**

```bash
git add app/brand/page.tsx
git commit -m "feat(brand): dense metrics strip for power users (adaptive layout)"
```

---

### Task 9: Housekeeping — remove pre-existing unused import

**Files:**
- Modify: `app/(auth)/signup/page.tsx`

**Context:** `npm run lint` reports one warning: `'Button' is defined but never used` in `app/(auth)/signup/page.tsx`. Remove it so lint is fully clean.

- [ ] **Step 1: Remove the import**

In `app/(auth)/signup/page.tsx`, delete the line:

```tsx
import { Button } from "@/components/ui/button";
```

(Only if `Button` is genuinely unused in that file — confirm first.)

- [ ] **Step 2: Verify lint is clean**

Run: `npm run lint`
Expected: `0 problems` (no warnings).

- [ ] **Step 3: Commit**

```bash
git add app/(auth)/signup/page.tsx
git commit -m "chore(signup): drop unused Button import"
```

---

## Deferred / Needs product decision

**Value anchoring / contrast pricing (checklist §1).** Not planned as a task. A genuine anchor (compare-at price, add-on tiers, "was $X") requires:
1. A pricing/add-on data model (new columns or an `offering_addons` table + migration under `supabase/migrations/`), and
2. Real numbers — `DESIGN.md` forbids fabricated metrics, so a fake strikethrough is out.

This is a product feature, not a polish fix. Recommended path if pursued: (a) add an optional `compare_at_cents` column to `offerings`; (b) let creators set it in `app/dashboard/offerings/page.tsx`; (c) render `<s>` compare-at beside the live price on storefront + booking only when `compare_at_cents > price_cents`. Scope it as its own spec/plan.

**Context-aware steppers (checklist §3).** Current number inputs (turnaround days, revisions) are acceptable; converting to steppers is low value. Deferred unless requested.

---

## Self-Review

**Spec coverage** (against the "still left to fix" list):
- Live deal countdown → Tasks 1–2 ✅
- Value anchoring → Deferred section (with rationale + concrete path) ✅
- Storefront rating next to name → Task 3 ✅
- Adaptive power-user layout → Task 8 ✅
- Persisted goals actually used → Task 5 ✅
- Consistent dynamic-CTA pricing (storefront sticky) → Task 4 ✅
- Delete guards on remaining actions → Task 6 ✅
- Book-page sticky bar → intentionally out of scope (documented in prior audit; mobile nav conflict) ✅
- Smart defaults on remaining forms → Task 7 (pitch) ✅
- Steppers → Deferred ✅
- Lint warning cleanup → Task 9 ✅

**Placeholder scan:** No "TBD"/"handle edge cases"/vague steps — each code step includes full code. Two steps ask the engineer to confirm an exact variable name/columns before editing (`app/brand/page.tsx` deal query, `signup/page.tsx` import) — these are verification instructions, not placeholders.

**Type consistency:** `msRemaining`/`formatRemaining`/`addMs`/`ACCEPT_WINDOW_MS`/`AUTO_APPROVE_WINDOW_MS` are defined in Task 1 and consumed with identical names/signatures in Task 2. `OnboardingWizard` `goals?: string[]` (Task 5), `CreatorPanel` `campaignTitle`/`offeringLabel` (Task 7), and `DeadlineCountdown` `{ deadlineIso, label }` (Task 2) are consistent across their definition and call sites.
