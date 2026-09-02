# Dashboard & Settings Restructure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce friction on the brand dashboard and settings by adding section jump-links to the long settings page, surfacing quick actions on the dashboard, and ensuring mobile nav includes Inbox.

**Architecture:** Two independent tasks (A–B) modifying existing pages. Task C (mobile nav Inbox) is already covered by deal-flow optimization Task 5 — noted here as a dependency, not re-implemented. No new files, no schema changes, no new dependencies.

**Tech Stack:** Next.js (App Router, Server Components), Supabase, Tailwind CSS, shadcn/ui

**Spec:** Bounded design approved in chat on 2026-09-02 (no separate spec file — three fixes to existing pages).

## Global Constraints

- **Design system:** Follow `DESIGN.md` — Gallery Frame. Ink pills for primary actions, outlined pills for secondary. Cards use `rounded-2xl bg-card p-6 shadow-card`. Amber only for trust/attention states.
- **No new dependencies.** All changes use existing components and patterns.
- **No schema changes.**
- **Server Components by default.** Client components only where interactivity requires it.
- **Dependency:** Task C (brand mobile nav Inbox tab + notification bell on mobile) is implemented in `docs/superpowers/plans/2026-09-02-deal-flow-optimization.md` Task 5. Implement that first or alongside these tasks.

---

### Task 1: Settings Section Jump-Links

**Files:**
- Modify: `app/brand/settings/page.tsx:65-69` (add jump-link nav below page title)
- Modify: `app/brand/settings/page.tsx:83,98,137,193` (add `id` attributes to each section)

**Interfaces:**
- Consumes: Nothing new — purely presentational.
- Produces: Anchor-based navigation within settings page. No new exports.

- [ ] **Step 1: Add id attributes to each settings section**

In `app/brand/settings/page.tsx`, add `id` props to the four `<section>` elements so jump-links can target them.

Line 83 currently:
```tsx
<section className="mt-8 rounded-2xl bg-card p-6 shadow-card">
```
Change to:
```tsx
<section id="import" className="mt-8 scroll-mt-20 rounded-2xl bg-card p-6 shadow-card">
```

Line 98 currently:
```tsx
<section className="mt-6 rounded-2xl bg-card p-6 shadow-card">
```
Change to:
```tsx
<section id="profile" className="mt-6 scroll-mt-20 rounded-2xl bg-card p-6 shadow-card">
```

Line 137 currently:
```tsx
<section className="mt-6 rounded-2xl bg-card p-6 shadow-card">
```
Change to:
```tsx
<section id="products" className="mt-6 scroll-mt-20 rounded-2xl bg-card p-6 shadow-card">
```

Line 193 already has `id="invites"`, just add `scroll-mt-20`:
```tsx
<section id="invites" className="mt-6 scroll-mt-20 rounded-2xl bg-card p-6 shadow-card">
```

`scroll-mt-20` offsets the scroll target below the sticky site-nav header (h-[~50px], 5rem = 80px gives breathing room).

- [ ] **Step 2: Add jump-link nav below the page title**

In `app/brand/settings/page.tsx`, after the `<h1>` tag (line 69) and before the error/success messages, add a horizontal link row:

```tsx
<nav className="mt-3 flex flex-wrap gap-1" aria-label="Settings sections">
  {[
    { href: "#import", label: "Import" },
    { href: "#profile", label: "Profile" },
    { href: "#products", label: "Products" },
    { href: "#invites", label: "Invites" },
  ].map((s) => (
    <a
      key={s.href}
      href={s.href}
      className="rounded-full border px-3 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      {s.label}
    </a>
  ))}
</nav>
```

Styling notes:
- Outlined pills match the design system's secondary button pattern (`rounded-full border`).
- No client-side state needed — these are plain `<a href="#id">` links that use native browser smooth-scroll (add `scroll-behavior: smooth` to `<html>` if not already present via Tailwind `scroll-smooth` class).

- [ ] **Step 3: Ensure smooth scroll is enabled**

Check `app/layout.tsx` for the `<html>` tag. If it doesn't already have `scroll-smooth`, add it:

```tsx
<html lang="en" className="scroll-smooth">
```

If it already has classes, append `scroll-smooth` to the existing className string.

- [ ] **Step 4: Test in browser**

1. Navigate to `/brand/settings`.
2. Verify 4 pill links appear below the title: Import · Profile · Products · Invites.
3. Click each link → page smooth-scrolls to the correct section with proper offset (section title visible, not hidden under nav).
4. Verify the `#invites` anchor from external links (e.g., dashboard "Invite a creator" link in Task 2) still works.
5. Test on mobile viewport — pills should wrap naturally.
6. Verify success/error messages still render correctly below the nav pills.

- [ ] **Step 5: Commit**

```bash
git add app/brand/settings/page.tsx app/layout.tsx
git commit -m "feat: add section jump-links to brand settings page"
```

---

### Task 2: Dashboard Quick Actions

**Files:**
- Modify: `app/brand/page.tsx:90-97` (add quick-action links to header button group)
- Modify: `app/brand/page.tsx:31-43` (add campaigns count query)

**Interfaces:**
- Consumes: `campaigns` table (count of brand's open campaigns)
- Produces: Updated header area with campaign link + invite shortcut. No new exports.

- [ ] **Step 1: Add campaigns count to the parallel data fetch**

In `app/brand/page.tsx`, add a campaigns count query to the existing `Promise.all` block (lines 31-43):

```tsx
const [profileRes, convRes, dealsRes, blockRes, campaignRes] = await Promise.all([
  supabase.from("brand_profiles").select("company").eq("user_id", user.id).maybeSingle(),
  supabase
    .from("conversations")
    .select("id, creator_id, status, created_at")
    .eq("brand_id", user.id)
    .order("created_at", { ascending: false }),
  supabase
    .from("deals")
    .select("id, creator_id, offering_title, price_cents, status, requested_at")
    .eq("brand_id", user.id)
    .order("requested_at", { ascending: false }),
  supabase.from("brand_blocklist").select("creator_id, created_at").eq("brand_id", user.id),
  supabase
    .from("campaigns")
    .select("id", { count: "exact", head: true })
    .eq("brand_id", user.id)
    .eq("status", "open"),
]);
```

After the destructured results, add:
```tsx
const openCampaigns = campaignRes.count ?? 0;
```

- [ ] **Step 2: Add quick-action buttons to the dashboard header**

In `app/brand/page.tsx`, replace the header buttons section (lines 90-97):

Current:
```tsx
<div className="flex gap-2">
  <Button asChild variant="outline" size="sm">
    <Link href="/brand/settings">Brand settings</Link>
  </Button>
  <Button asChild size="sm">
    <Link href="/discover">Find creators</Link>
  </Button>
</div>
```

New:
```tsx
<div className="flex flex-wrap gap-2">
  <Button asChild variant="outline" size="sm">
    <Link href="/brand/settings">Settings</Link>
  </Button>
  <Button asChild variant="outline" size="sm">
    <Link href="/brand/settings#invites">Invite a creator</Link>
  </Button>
  <Button asChild variant="outline" size="sm">
    <Link href="/campaigns">
      Campaigns{openCampaigns > 0 ? ` (${openCampaigns})` : ""}
    </Link>
  </Button>
  <Button asChild size="sm">
    <Link href="/discover">Find creators</Link>
  </Button>
</div>
```

Changes:
- "Brand settings" shortened to "Settings" (saves space, unambiguous in context).
- "Invite a creator" links to `/brand/settings#invites` — uses the anchor from Task 1.
- "Campaigns (N)" shows open campaign count as a nudge.
- "Find creators" stays as the primary ink pill CTA.
- `flex-wrap` ensures buttons wrap on narrow viewports instead of overflowing.

- [ ] **Step 3: Test in browser**

1. Navigate to `/brand` (dashboard).
2. Verify 4 buttons in header: Settings | Invite a creator | Campaigns (N) | Find creators.
3. "Find creators" should be the only ink pill (primary). Others are outlined.
4. Click "Invite a creator" → navigates to `/brand/settings` and scrolls to the Invites section.
5. Click "Campaigns (N)" → navigates to `/campaigns`. Verify the count matches actual open campaigns.
6. If no open campaigns exist, button shows "Campaigns" with no count — still functional.
7. Verify buttons wrap gracefully on mobile viewport.
8. Verify the campaigns query doesn't slow down page load (it's a count-only head query, should be fast).

- [ ] **Step 4: Commit**

```bash
git add app/brand/page.tsx
git commit -m "feat: add quick-action shortcuts to brand dashboard header"
```

---

### Dependency Note: Task C — Mobile Nav Inbox Tab

This optimization (replacing the central "New Campaign" button with Inbox in brand mobile nav, and making the notification bell visible on mobile) is fully implemented in:

**`docs/superpowers/plans/2026-09-02-deal-flow-optimization.md` → Task 5**

Summary of what that task does:
- Replaces `BRAND_TABS` central "New" button with an Inbox tab (`/inbox`, MessageIcon)
- Adds unread badge to the Inbox tab (reuses notification count)
- Changes notification bell in `site-nav.tsx` from `hidden md:grid` to `grid` (visible on all viewports)

**Implement deal-flow Task 5 before or alongside this plan's tasks.** No additional work needed here.
