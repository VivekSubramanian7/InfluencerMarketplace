# Workspace Density Pass — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining structural gap between Clipline and Passionfroot's workspace density: strip shadow-cards from in-app surfaces, convert work queues to dense rows with inline actions, add the `+ New…` create button to the rail, add avatars to conversation rows, expand filter tokens to all list pages, and ship proper two-state empty states.

**Architecture:** Six tasks, each independently deployable. Task 1 is a CSS + global sweep that every other task benefits from, so it goes first. Tasks 2–6 are page-level rewrites that depend on the new row style from Task 1 but are independent of each other and can be parallelized.

**Tech Stack:** Next.js (App Router, server components), Tailwind CSS, Supabase, TypeScript, Vitest

**Spec:** `DESIGN.md` (the design system) + `docs/PASSIONFROOT-UI-GAP-ANALYSIS.md` (the reasoning)

## Global Constraints

- **DESIGN.md is law.** Every visual decision must match its tokens. When in doubt, re-read.
- **Two registers.** Public pages (`/`, `/c/[handle]`, auth pages) keep `shadow-card`, `font-black`, `rounded-2xl`, hover lifts. App pages (everything behind auth) must not use any of them.
- **Elevation in-app:** hairlines (`--border`) + color steps (`--ground` → `--rail` → `--card`). Shadow only on floating layers (menus, popovers, modals).
- **Radii in-app:** 8px buttons/inputs, 12px cards/tiles, 16px panel. `rounded-full` only for active nav pill, tab switchers, status chips, avatars.
- **Type in-app:** max 24px/600 page title, 14px body, 13px meta. Weight ceiling 700, and 700 is rare.
- **Row rule:** every work-queue row must carry identity (avatar), meta/preview, status chip, and the resolved next action as a right-aligned button. Navigation-only rows are bugs.
- **Empty states:** every list needs first-run (illustration optional, CTA required) AND no-results ("No results match your filters" + Reset filters link). A dashed box with "Nothing here." is a dead end.
- **Filter token bar:** every list page gets one, backed by URL search params.
- **No new dependencies.** Everything here is HTML/CSS/Tailwind.
- Run `pnpm exec vitest run` after each task to confirm no regressions.

---

### Task 1: Strip shadow-card and hover-lift from all App-register surfaces

The foundation task. Every subsequent task builds rows on flat surfaces, so this goes first.

**Files:**
- Modify: `app/globals.css` — scope `shadow-card` utility to public register only
- Modify: `app/deals/page.tsx:77` — remove shadow-card, hover lift, rounded-2xl
- Modify: `app/deals/[id]/page.tsx:248,269` — remove shadow-card
- Modify: `app/deals/loading.tsx:18` — remove shadow-card
- Modify: `app/brand/page.tsx:100,188,247,283,322` — remove shadow-card, hover lift
- Modify: `app/brand/settings/page.tsx:98,113,152,208` — remove shadow-card
- Modify: `app/dashboard/page.tsx:235,266,287` — remove shadow-card
- Modify: `app/dashboard/loading.tsx:14,23,35` — remove shadow-card
- Modify: `app/inbox/page.tsx:141` — remove shadow-card
- Modify: `app/inbox/[id]/page.tsx:321` — remove shadow-card
- Modify: `app/discover/page.tsx:169` — remove shadow-card from filter section (keep on discover cards — browse, not work)
- Modify: `app/notifications/page.tsx` (via `components/notifications/notification-list.tsx:94,102,109`) — remove shadow-card, hover lift
- Modify: `components/creator/portfolio-panel.tsx:75,111` — remove shadow-card (keep on portfolio items if they're browse cards)
- Modify: `components/inbox/conversation-list.tsx:67` — remove rounded-2xl from empty state

**Interfaces:**
- Consumes: nothing
- Produces: all in-app surfaces are flat with hairline borders; later tasks can rely on `border border-[var(--border)] rounded-[var(--radius-tile)]` as the row style

**Do NOT touch:** `app/page.tsx`, `app/c/[handle]/page.tsx`, `app/(auth)/*.tsx`, `components/discover/search-suggest.tsx` (popover, floating layer) — these are Public register or floating layers where shadow is correct.

- [ ] **Step 1: Audit and list every shadow-card in app-register files**

Grep results above give us the full list. Classify each hit:
- App register (strip): `app/deals/`, `app/brand/`, `app/dashboard/`, `app/inbox/`, `app/notifications/`, `components/notifications/`, `components/creator/portfolio-panel.tsx` (the upload form section)
- Public register (keep): `app/page.tsx`, `app/c/[handle]/page.tsx`, `app/(auth)/`
- Browse cards (keep shadow, keep hover-lift): `app/discover/page.tsx:376` (creator cards)
- Floating layer (keep): `components/discover/search-suggest.tsx:50`

- [ ] **Step 2: In `app/globals.css`, add a comment clarifying shadow-card scope**

The shadow-card utility classes already exist at lines 142-146. Add a comment above them:

```css
/* ponytail: shadow-card is Public-register only (landing, /c/[handle], auth).
   App-register surfaces use hairlines + color steps per DESIGN.md. */
```

- [ ] **Step 3: Strip shadow-card from deal rows — `app/deals/page.tsx`**

Replace the deal row class at line 77:

Old:
```tsx
className="deal-row flex items-center justify-between gap-4 rounded-2xl bg-card p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover"
```

New:
```tsx
className="flex items-center justify-between gap-4 rounded-[var(--radius-tile)] border border-[var(--border)] p-4 transition-colors hover:bg-[var(--row-hover)]"
```

- [ ] **Step 4: Strip shadow-card from deal detail sections — `app/deals/[id]/page.tsx`**

Lines 248 and 269 — replace `rounded-2xl bg-card p-6 shadow-card` with `rounded-[var(--radius-tile)] border border-[var(--border)] p-5`.

- [ ] **Step 5: Strip shadow-card from deal loading skeleton — `app/deals/loading.tsx`**

Line 18 — same replacement pattern as step 3.

- [ ] **Step 6: Strip shadow-card from brand home — `app/brand/page.tsx`**

Five locations. For stat cards (line 100): replace `rounded-2xl bg-card p-6 shadow-card transition-shadow hover:shadow-card-hover` with `rounded-[var(--radius-tile)] border border-[var(--border)] p-5`.

For deal rows (lines 247, 283, 322): same pattern as deal rows in step 3.

For the section wrapper (line 188): replace `rounded-2xl bg-card p-6 shadow-card` with `rounded-[var(--radius-tile)] border border-[var(--border)] p-5`.

- [ ] **Step 7: Strip shadow-card from brand settings — `app/brand/settings/page.tsx`**

Lines 98, 113, 152, 208 — replace `rounded-2xl bg-card p-6 shadow-card` with `rounded-[var(--radius-tile)] border border-[var(--border)] p-5`.

- [ ] **Step 8: Strip shadow-card from dashboard — `app/dashboard/page.tsx`**

Lines 235, 266, 287 — same replacement.

- [ ] **Step 9: Strip shadow-card from dashboard loading — `app/dashboard/loading.tsx`**

Lines 14, 23, 35 — same replacement.

- [ ] **Step 10: Strip shadow-card from inbox invitation cards — `app/inbox/page.tsx`**

Line 141 — replace `rounded-2xl bg-card p-6 shadow-card ring-1 ring-amber/20` with `rounded-[var(--radius-tile)] border border-[var(--border)] bg-[var(--card)] p-5 ring-1 ring-amber/20`.

- [ ] **Step 11: Strip shadow-card from inbox detail — `app/inbox/[id]/page.tsx`**

Line 321 — same replacement pattern.

- [ ] **Step 12: Strip shadow-card from discover filter section — `app/discover/page.tsx`**

Line 169 only (the saved-search panel, not the creator browse cards). Replace `rounded-2xl bg-card p-5 shadow-card` with `rounded-[var(--radius-tile)] border border-[var(--border)] p-5`.

**Keep** lines 376, 386, 355, 364 — those are discover browse cards and floating controls where shadow is correct per DESIGN.md.

- [ ] **Step 13: Strip shadow-card from notifications — `components/notifications/notification-list.tsx`**

Lines 94, 102, 109 — replace shadow-card + hover-lift with hairline + hover-fill:

Old pattern: `deal-row ... rounded-2xl bg-card p-4 ... shadow-card ... hover:-translate-y-0.5 hover:shadow-card-hover`

New pattern: `flex items-center justify-between gap-4 rounded-[var(--radius-tile)] border border-[var(--border)] p-4 transition-colors hover:bg-[var(--row-hover)]`

For the unread ring (line 109): keep `ring-1 ring-amber/20` on unread items.

- [ ] **Step 14: Strip shadow-card from portfolio upload section — `components/creator/portfolio-panel.tsx`**

Line 75 (the upload form section): replace `rounded-2xl bg-card p-6 shadow-card` with `rounded-[var(--radius-tile)] border border-[var(--border)] p-5`.

Lines 111, 114 — keep shadow-card on portfolio item cards; these are browse items, not work queue rows.

- [ ] **Step 15: Fix conversation list empty state radius — `components/inbox/conversation-list.tsx`**

Line 67: replace `rounded-2xl border border-dashed` with `rounded-[var(--radius-tile)] border border-dashed`.

- [ ] **Step 16: Also strip font-extrabold from in-app deal prices**

`app/deals/page.tsx:88`, `app/campaigns/page.tsx:154,216` — replace `font-extrabold` with `font-semibold` (weight 600, the DESIGN.md ceiling for metric values).

- [ ] **Step 17: Run tests**

Run: `pnpm exec vitest run`
Expected: all pass (these are CSS-only changes, no logic changed)

- [ ] **Step 18: Commit**

```bash
git add app/globals.css app/deals/ app/brand/ app/dashboard/ app/inbox/ app/notifications/ app/discover/page.tsx components/notifications/ components/creator/portfolio-panel.tsx components/inbox/conversation-list.tsx app/campaigns/page.tsx
git commit -m "style: strip shadow-card and hover-lift from App-register surfaces

Replace shadow-card elevation with hairline borders and color steps
per DESIGN.md workspace direction. Public-register pages (landing,
storefronts, auth) retain shadows.

Co-Authored-By: Claude Opus 4 <noreply@anthropic.com>"
```

---

### Task 2: Dense deal rows with inline next-action button

Convert deals from navigation-only shadow-cards to dense rows showing the resolved next action. This is the single highest-impact density change — Passionfroot's "Request payment →" / "View application →" pattern.

**Files:**
- Modify: `app/deals/page.tsx` — rewrite the `section()` render function
- Modify: `lib/deals/ui-actions.ts` — add `primaryActionLabel()` helper
- Create: `lib/deals/__tests__/primary-action.test.ts`

**Interfaces:**
- Consumes: `actionsFor()` from `lib/deals/ui-actions.ts`, `DealStatus`/`PaymentMode` from `lib/deals/machine.ts`
- Produces: `primaryActionLabel(status, role, mode): string | null` — returns the label of the first non-confirm action, or null if no action available. Used by deals page and brand home.

- [ ] **Step 1: Write the failing test for `primaryActionLabel`**

Create `lib/deals/__tests__/primary-action.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { primaryActionLabel } from "@/lib/deals/ui-actions";

describe("primaryActionLabel", () => {
  it("creator on requested (off_platform): Accept deal", () => {
    expect(primaryActionLabel("requested", "creator", "off_platform")).toBe("Accept deal");
  });

  it("creator on in_production: Start production — wait, that's accepted", () => {
    expect(primaryActionLabel("accepted", "creator", "off_platform")).toBe("Start production");
  });

  it("brand on submitted: Request changes", () => {
    expect(primaryActionLabel("submitted", "brand", "off_platform")).toBe("Request changes");
  });

  it("brand on published: Approve & complete", () => {
    expect(primaryActionLabel("published", "brand", "off_platform")).toBe("Approve & complete");
  });

  it("terminal states return null", () => {
    expect(primaryActionLabel("completed", "brand", "off_platform")).toBeNull();
    expect(primaryActionLabel("cancelled", "creator", "off_platform")).toBeNull();
  });

  it("disputed returns null (no non-confirm actions)", () => {
    expect(primaryActionLabel("disputed", "brand", "off_platform")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run lib/deals/__tests__/primary-action.test.ts`
Expected: FAIL — `primaryActionLabel` is not exported

- [ ] **Step 3: Implement `primaryActionLabel` in `lib/deals/ui-actions.ts`**

Add at the bottom of the file:

```typescript
export function primaryActionLabel(
  status: DealStatus,
  role: "brand" | "creator",
  mode: PaymentMode,
): string | null {
  const first = actionsFor(status, role, mode).find((a) => !a.confirm);
  return first?.label ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run lib/deals/__tests__/primary-action.test.ts`
Expected: PASS

- [ ] **Step 5: Rewrite deal row rendering in `app/deals/page.tsx`**

Replace the `section()` function (lines 56–98) with dense rows. Each row:
- Left: avatar initial (first char of `offering_title`) + title + meta text (`buying`/`selling` + relative time)
- Center: status badge
- Right: price + inline action button (or `→` link if no action)

Replace the section function body with:

```tsx
const section = (title: string, rows: typeof mine, accent?: boolean) => (
  <section className="mb-8">
    <h2 className="flex items-center gap-2.5 text-lg font-semibold">
      {accent && rows.length > 0 && (
        <span aria-hidden className="size-2 rounded-full bg-[var(--amber)]" />
      )}
      {title}
      <span className="ml-1 text-sm font-medium text-[var(--muted)] tabular-nums">
        {rows.length}
      </span>
    </h2>
    {rows.length === 0 ? (
      <p className="mt-3 rounded-[var(--radius-tile)] border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--muted)]">
        Nothing matching this section right now.
      </p>
    ) : (
      <ul className="mt-3 divide-y divide-[var(--divider)]">
        {rows.map((d) => {
          const r = myRole(d);
          const action = primaryActionLabel(d.status as DealStatus, r, d.payment_mode as PaymentMode);
          return (
            <li key={d.id}>
              <Link
                href={`/deals/${d.id}`}
                className="flex items-center gap-4 px-2 py-3 transition-colors hover:bg-[var(--row-hover)]"
              >
                <span
                  aria-hidden
                  className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--ground)] text-xs font-semibold text-[var(--ink)]"
                >
                  {(d.offering_title ?? "?").charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{d.offering_title}</span>
                  <span className="block truncate text-xs text-[var(--muted)]">
                    {r === "brand" ? "Buying" : "Selling"}
                    {d.requested_at ? ` · ${timeAgo(d.requested_at)}` : ""}
                  </span>
                </span>
                <Badge variant="secondary" className="shrink-0">
                  {STATUS_LABELS[d.status] ?? d.status}
                </Badge>
                <span className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums">
                  ${(d.price_cents / 100).toFixed(0)}
                </span>
                {action ? (
                  <span className="shrink-0 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--primary-foreground)]">
                    {action} →
                  </span>
                ) : (
                  <span className="shrink-0 text-xs text-[var(--muted)]">→</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    )}
  </section>
);
```

- [ ] **Step 6: Add `timeAgo` helper and `primaryActionLabel` import to `app/deals/page.tsx`**

Add at top of file:
```typescript
import { actionsFor, primaryActionLabel } from "@/lib/deals/ui-actions";
```

Add the `timeAgo` helper before the component (same one from `conversation-list.tsx`):
```typescript
function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
```

- [ ] **Step 7: Run all tests**

Run: `pnpm exec vitest run`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add lib/deals/ui-actions.ts lib/deals/__tests__/primary-action.test.ts app/deals/page.tsx
git commit -m "feat: dense deal rows with inline next-action button

Deal list now shows avatar, title, relative time, status chip, price,
and the resolved next action per row — matching Passionfroot's density.
Navigation-only rows eliminated per DESIGN.md.

Co-Authored-By: Claude Opus 4 <noreply@anthropic.com>"
```

---

### Task 3: `+ New…` create button in the rail

Passionfroot's most prominent chrome element after the identity block. Role-aware: creators see "New offering" / "Block calendar"; brands see "New campaign" / "Invite creator".

**Files:**
- Modify: `components/app-rail.tsx` — add create button between identity block and nav

**Interfaces:**
- Consumes: `role` from `AppRailProps`
- Produces: a dropdown menu in the rail; no new exports

- [ ] **Step 1: Add the create button markup to `app-rail.tsx`**

After the identity block's closing `</button>` and `{detailsOpen && ...}` block (after line 145), before the `<nav>` (line 147), add:

```tsx
<div className="mt-3">
  <details className="group">
    <summary className="flex w-full cursor-pointer items-center gap-2 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)] transition-colors hover:opacity-90 [&::-webkit-details-marker]:hidden">
      <span aria-hidden className="text-base leading-none">+</span>
      <span className="flex-1">New…</span>
      <span aria-hidden className="text-xs transition-transform group-open:rotate-180">▾</span>
    </summary>
    <ul className="mt-1 rounded-lg border border-[var(--border)] bg-[var(--card)] p-1 shadow-[var(--shadow-float)]">
      {role === "creator" ? (
        <>
          <li>
            <Link href="/dashboard?tab=offerings&new=1" onClick={() => {}} className="block rounded-md px-3 py-2 text-sm transition-colors hover:bg-[var(--row-hover)]">
              New offering
            </Link>
          </li>
          <li>
            <Link href="/inbox" className="block rounded-md px-3 py-2 text-sm transition-colors hover:bg-[var(--row-hover)]">
              Start conversation
            </Link>
          </li>
        </>
      ) : role === "brand" ? (
        <>
          <li>
            <Link href="/campaigns?new=1" className="block rounded-md px-3 py-2 text-sm transition-colors hover:bg-[var(--row-hover)]">
              New campaign
            </Link>
          </li>
          <li>
            <Link href="/discover" className="block rounded-md px-3 py-2 text-sm transition-colors hover:bg-[var(--row-hover)]">
              Find creators
            </Link>
          </li>
        </>
      ) : null}
    </ul>
  </details>
</div>
```

- [ ] **Step 2: Verify shadow-float is defined**

Check `app/globals.css` for `--shadow-float`. It should be defined per DESIGN.md as `0 8px 24px rgb(27 25 23 / 0.12)`. If not, add it to the `:root` block:

```css
--shadow-float: 0 8px 24px rgb(27 25 23 / 0.12);
```

- [ ] **Step 3: Test visually**

Run: `pnpm dev`
Navigate to any authenticated page. Verify:
- The `+ New…` button appears between the identity block and the first nav group
- Clicking it opens a dropdown with role-appropriate options
- The dropdown has the float shadow (the one permitted floating-layer shadow)
- Clicking an option navigates correctly

- [ ] **Step 4: Commit**

```bash
git add components/app-rail.tsx app/globals.css
git commit -m "feat: add + New… create button to app rail

Role-aware create dropdown: creators get 'New offering' and 'Start
conversation'; brands get 'New campaign' and 'Find creators'. Uses
native <details> — no JS dropdown library needed.

Co-Authored-By: Claude Opus 4 <noreply@anthropic.com>"
```

---

### Task 4: Avatars on conversation list rows + Active/Archived tabs

Two inbox density gaps: no avatar initials on conversation rows, and no Active/Archived tab split.

**Files:**
- Modify: `components/inbox/conversation-list.tsx` — add avatar initial, tighten row density
- Modify: `app/inbox/page.tsx` — wire Active/Archived tabs (replace status filter pills)

**Interfaces:**
- Consumes: `ConversationRow` interface (already has `label`)
- Produces: visual-only changes; no new exports

- [ ] **Step 1: Add avatar initial to conversation rows in `components/inbox/conversation-list.tsx`**

In both the desktop and mobile `<Link>` blocks (lines 92-119 and 121-149), add an avatar initial as the first child inside the Link:

```tsx
<span
  aria-hidden
  className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--ground)] text-xs font-semibold text-[var(--ink)]"
>
  {c.label.charAt(0).toUpperCase()}
</span>
```

- [ ] **Step 2: Tighten row padding**

Change both Link elements' padding from `p-4` to `px-2 py-3` for denser rows matching the 44-48px row height spec.

- [ ] **Step 3: Replace the inbox filter tabs in `app/inbox/page.tsx`**

Lines 95-117 currently show All/Active/Pending/Declined. Replace with a simpler Active/Archived tab pair matching Passionfroot's `creator-02.png`:

```tsx
<nav className="mt-3 flex gap-1" aria-label="Filter conversations">
  {[
    { value: "active", label: "Active" },
    { value: "archived", label: "Archived" },
  ].map((f) => {
    const active = (status ?? "active") === f.value;
    return (
      <Link
        key={f.value}
        href={f.value === "active" ? "/inbox" : `/inbox?status=${f.value}`}
        className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
          active
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
        }`}
      >
        {f.label}
      </Link>
    );
  })}
</nav>
```

Note: "Archived" filtering requires that the conversation query filters on an `archived` flag. If the conversations table doesn't have an `archived` column yet, the "Archived" tab should show an empty state for now — the tab needs to exist for UI parity even if the backend column comes later.

- [ ] **Step 4: Update conversation filtering logic**

Update the filtering at lines 79-82 to match. If `status === "archived"`, filter to archived conversations. Otherwise show non-archived:

```typescript
const pendingForMe = mine.filter((c) => c.status === "invited" && c.creator_id === user.id);
const archived = status === "archived";
const allRest = mine.filter((c) => !pendingForMe.includes(c));
const rest = archived
  ? [] // ponytail: empty until archived column exists on conversations table
  : allRest;
```

- [ ] **Step 5: Test visually**

Run: `pnpm dev`, navigate to `/inbox`. Verify:
- Avatar initials appear on each conversation row
- Active/Archived tabs render and toggle
- Row density is tighter (closer to 44-48px)

- [ ] **Step 6: Commit**

```bash
git add components/inbox/conversation-list.tsx app/inbox/page.tsx
git commit -m "feat: add avatars to inbox rows and Active/Archived tabs

Conversation rows now show avatar initial, tighter padding for ~10
rows per viewport. Tab filter simplified to Active/Archived matching
Passionfroot's inbox pattern.

Co-Authored-By: Claude Opus 4 <noreply@anthropic.com>"
```

---

### Task 5: Filter token bar on campaigns and inbox pages

Currently only `/deals` has a filter token bar. DESIGN.md requires one on every list. Add to `/campaigns` (status filter for brands, offering_type for creators) and `/inbox` (integrate with the Active/Archived tabs from Task 4).

**Files:**
- Modify: `app/campaigns/page.tsx` — add FilterTokenBar with `status` and `offering_type` filters
- Modify: `lib/filters/tokens.ts` — add labels for new filter keys

**Interfaces:**
- Consumes: `FilterTokenBar` component, `parseFilterTokens` function
- Produces: URL-param-backed filtering on campaigns page

- [ ] **Step 1: Add filter key labels to `lib/filters/tokens.ts`**

Update the `LABELS` record:

```typescript
const LABELS: Record<string, string> = {
  status: "Status",
  needs_me: "Needs me",
  offering_type: "Format",
  applied: "Applied",
};
```

- [ ] **Step 2: Add FilterTokenBar to brand campaigns view in `app/campaigns/page.tsx`**

Import at top:
```typescript
import { FilterTokenBar } from "@/components/filters/filter-token-bar";
import { parseFilterTokens } from "@/lib/filters/tokens";
```

Update `searchParams` type to include `status` and `offering_type`:
```typescript
searchParams: Promise<{
  error?: string;
  saved?: string;
  clone?: string;
  prefill_type?: string;
  prefill_niche?: string;
  status?: string;
  offering_type?: string;
}>
```

Add filter token parsing after destructuring searchParams in the main component:
```typescript
const filterSp = new URLSearchParams();
if (sp.status) filterSp.set("status", sp.status);
if (sp.offering_type) filterSp.set("offering_type", sp.offering_type);
const tokens = parseFilterTokens(filterSp, ["status", "offering_type"]);
```

(Where `sp` is the destructured searchParams — rename the existing destructuring to `const sp = await searchParams;` and extract individual vars from it.)

Add `<FilterTokenBar>` after the subtitle `<p>` and before the error/saved messages:

```tsx
<FilterTokenBar
  tokens={tokens}
  basePath="/campaigns"
  allowedKeys={[
    { key: "status", label: "Status", options: [
      { value: "open", label: "Open" },
      { value: "closed", label: "Closed" },
    ]},
    { key: "offering_type", label: "Format", options: [
      { value: "short_form_post", label: "Short-form post" },
      { value: "dedicated_video", label: "Dedicated video" },
      { value: "integration", label: "Integration" },
      { value: "ugc_video", label: "UGC video" },
    ]},
  ]}
/>
```

- [ ] **Step 3: Wire filter logic into the brand campaigns query**

In the `BrandCampaigns` component, accept `tokens` as a prop and apply filters:

Add to `BrandCampaigns` props: `tokens: FilterToken[]`

After fetching campaigns, filter client-side:
```typescript
const filtered = (campaigns ?? []).filter((c) => {
  for (const t of tokens) {
    if (t.key === "status" && c.status !== t.value) return false;
    if (t.key === "offering_type" && c.offering_type !== t.value) return false;
  }
  return true;
});
```

Use `filtered` instead of `campaigns ?? []` in the render.

- [ ] **Step 4: Run tests**

Run: `pnpm exec vitest run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/filters/tokens.ts app/campaigns/page.tsx
git commit -m "feat: add filter token bar to campaigns page

Brand campaigns can now filter by status and offering type via URL-backed
removable tokens, matching the filter-token-bar pattern from DESIGN.md.

Co-Authored-By: Claude Opus 4 <noreply@anthropic.com>"
```

---

### Task 6: Two-state empty states on all list pages

Every list page needs first-run (CTA to create) and no-results (reset filters). Currently most pages show a generic dashed box. This task adds proper two-state empty states to deals, campaigns, inbox, and notifications.

**Files:**
- Modify: `app/deals/page.tsx` — already has two states from the previous branch; verify and improve copy
- Modify: `app/campaigns/page.tsx` — add no-results state for filtered view
- Modify: `app/inbox/page.tsx` — distinguish "no conversations yet" from "no results"
- Modify: `components/notifications/notification-list.tsx` — add proper empty states
- Modify: `components/inbox/conversation-list.tsx` — improve empty state copy and add filter-reset

**Interfaces:**
- Consumes: filter tokens from each page
- Produces: visual-only changes; no new exports

- [ ] **Step 1: Verify deals page empty states**

`app/deals/page.tsx` lines 111-126 already have:
- First-run: "No deals yet." + CTA button — good
- No-results: "No results match your filters." + Reset link — good

Improve the first-run copy. Replace "No deals yet." with a more helpful message:

```tsx
<p className="font-medium text-[var(--ink)]">No deals yet</p>
<p className="mt-1 text-sm text-[var(--muted)]">
  {role === "brand"
    ? "Start a campaign and deals will appear here as creators accept."
    : "Apply to open campaigns — accepted deals show up here."}
</p>
```

- [ ] **Step 2: Add two-state empty to brand campaigns**

In `BrandCampaigns`, after the filter logic from Task 5, wrap the campaign list with:

```tsx
{filtered.length === 0 && tokens.length > 0 ? (
  <div className="mt-6 text-center">
    <p className="text-sm text-[var(--muted)]">No campaigns match your filters.</p>
    <Link href="/campaigns" className="mt-2 inline-block text-sm font-medium underline underline-offset-2">
      Reset filters
    </Link>
  </div>
) : filtered.length === 0 ? (
  <div className="mt-6 rounded-[var(--radius-tile)] border border-[var(--border)] p-8 text-center">
    <p className="font-medium text-[var(--ink)]">No campaigns yet</p>
    <p className="mt-1 text-sm text-[var(--muted)]">Post your first brief and let creators pitch.</p>
  </div>
) : (
  <ul className="mt-6 flex flex-col gap-2">
    {/* existing campaign list rendering */}
  </ul>
)}
```

- [ ] **Step 3: Add two-state empty to creator campaigns**

In `CreatorCampaigns`, replace the existing single empty state (lines 230-233):

```tsx
{(campaigns ?? []).length === 0 ? (
  <li className="rounded-[var(--radius-tile)] border border-[var(--border)] p-8 text-center">
    <p className="font-medium text-[var(--ink)]">No open campaigns right now</p>
    <p className="mt-1 text-sm text-[var(--muted)]">Brands post briefs here — check back soon.</p>
  </li>
) : null}
```

- [ ] **Step 4: Improve inbox conversation list empty state**

In `components/inbox/conversation-list.tsx`, the empty states at lines 66-87 already distinguish by role but not by filter state. Add a `hasFilters` check:

Update the component props to accept an optional `hasFilters?: boolean`:

```typescript
export function ConversationList({
  conversations,
  status,
  totalCount,
  role,
  hasFilters = false,
}: {
  conversations: ConversationRow[];
  status: string | null;
  totalCount: number;
  role: string;
  hasFilters?: boolean;
}) {
```

Then update the empty state:

```tsx
{filtered.length === 0 ? (
  <div className="mt-3 rounded-[var(--radius-tile)] border border-[var(--border)] p-8 text-center">
    {search ? (
      <p className="text-sm text-[var(--muted)]">No conversations match "{search}".</p>
    ) : hasFilters ? (
      <>
        <p className="text-sm text-[var(--muted)]">No conversations match your filters.</p>
        <Link href="/inbox" className="mt-2 inline-block text-sm font-medium underline underline-offset-2">
          Reset filters
        </Link>
      </>
    ) : role === "brand" ? (
      <>
        <p className="font-medium text-[var(--ink)]">No conversations yet</p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Reach out to creators from{" "}
          <Link href="/discover" className="font-medium underline underline-offset-2">Discover</Link>.
        </p>
      </>
    ) : (
      <>
        <p className="font-medium text-[var(--ink)]">No conversations yet</p>
        <p className="mt-1 text-sm text-[var(--muted)]">Brands you accept will appear here.</p>
      </>
    )}
  </div>
) : (
```

Pass `hasFilters={status !== null && status !== "active"}` from `app/inbox/page.tsx` when rendering `<ConversationList>`.

- [ ] **Step 5: Improve notification empty state**

In `components/notifications/notification-list.tsx`, find the empty state and replace any generic message with:

```tsx
<div className="rounded-[var(--radius-tile)] border border-[var(--border)] p-8 text-center">
  <p className="font-medium text-[var(--ink)]">No notifications yet</p>
  <p className="mt-1 text-sm text-[var(--muted)]">Activity on your deals, campaigns, and messages will show up here.</p>
</div>
```

- [ ] **Step 6: Run tests**

Run: `pnpm exec vitest run`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add app/deals/page.tsx app/campaigns/page.tsx app/inbox/page.tsx components/inbox/conversation-list.tsx components/notifications/notification-list.tsx
git commit -m "feat: two-state empty states on all list pages

Every list now distinguishes first-run (explain + CTA) from no-results
(reset filters link), per DESIGN.md empty state rules.

Co-Authored-By: Claude Opus 4 <noreply@anthropic.com>"
```

---

## Summary of what's skipped (and when to add it)

| Skipped | Add when |
|---------|----------|
| Brand home deal rows with inline actions (`app/brand/page.tsx`) | Next pass — same pattern as Task 2, just needs `primaryActionLabel` wired in |
| Nav vocabulary rename (Dashboard → Home, Deals → Collaborations) | Product decision — needs stakeholder sign-off on the new labels |
| Persistent floating setup checklist | After the onboarding flow is stable and the completion query is reliable |
| Scoped settings section with its own rail | When settings has enough pages to justify the split (currently 2 pages) |
| Calendar/availability page | New feature, not a density fix |
| Storefront stats + share module | New feature |
| Help center link + support bubble in rail | Needs a support provider (Intercom, etc.) decision first |
| Discover page cards — keep shadow (browse items, not work queue) | Already correct per DESIGN.md |
| AI as brand home entry point | Product bet, not a UI port |
