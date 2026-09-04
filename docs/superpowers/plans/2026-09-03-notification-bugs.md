# Notification Bug Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 4 real bugs in the notification system — wrong badge on Inbox tab, stale `hasUnread` check, `markAllRead` ignoring active category filter, and SiteNav silently swallowing auth failures.

**Architecture:** Four independent, small fixes. No new files, no schema changes, no new dependencies. Each task touches 1-2 files. Tasks are independent and can be executed in any order or in parallel.

**Tech Stack:** Next.js (App Router, Server Components), Supabase, Tailwind CSS

**Spec:** Analysis from conversation on 2026-09-03 identifying 5 bugs. Bug 5 (no real-time updates) is a feature enhancement, deferred.

## Global Constraints

- **No new dependencies.** All fixes use existing patterns.
- **No schema changes.**
- **Follow existing auth pattern:** `requireUser()` from `@/lib/auth/require` for authenticated server components/actions. `getClaims()` under the hood via cached `getUserAndRole()`.
- **`revalidatePath("/", "layout")`** is the existing cache-bust pattern — keep using it.
- **Design system:** Follow `DESIGN.md`. Badge styling unchanged.

---

### Task 1: Remove Notification Badge from Mobile Inbox Tab

**Problem:** `mobile-nav.tsx:86` shows the `unread` notification count on both `tab.label === "Alerts"` AND `tab.label === "Inbox"`. The count is notification-unread, not message-unread. The Inbox has no unread message tracking, so the badge is misleading.

**Files:**
- Modify: `components/mobile-nav.tsx:86`

**Interfaces:**
- Consumes: `unread` prop (unchanged).
- Produces: Badge only on "Alerts" tab (no new exports).

- [ ] **Step 1: Remove "Inbox" from the badge condition**

In `components/mobile-nav.tsx`, change line 86 from:

```tsx
{(tab.label === "Alerts" || tab.label === "Inbox") && unread > 0 && (
```

to:

```tsx
{tab.label === "Alerts" && unread > 0 && (
```

- [ ] **Step 2: Test in browser (mobile viewport)**

1. Open browser DevTools, switch to mobile viewport.
2. Navigate to any authenticated page.
3. Verify the "Alerts" tab still shows the unread badge with the correct count.
4. Verify the "Inbox" tab no longer shows any badge.
5. Check both Creator and Brand roles (different tab sets, both have Alerts + Inbox).

- [ ] **Step 3: Commit**

```bash
git add components/mobile-nav.tsx
git commit -m "fix: remove misleading notification badge from mobile Inbox tab"
```

---

### Task 2: Fix `hasUnread` to Use a Dedicated Count Query

**Problem:** `app/notifications/page.tsx:82` computes `hasUnread` from `rows.some((n) => !n.read_at)` — but `rows` is limited to 50. If the first 50 are read and #51 is unread, the "Mark all read" button disappears while the bell badge still shows a count.

**Files:**
- Modify: `app/notifications/page.tsx:36-82`

**Interfaces:**
- Consumes: Supabase query result.
- Produces: `hasUnread` boolean passed to `NotificationList` (interface unchanged).

- [ ] **Step 1: Add a separate unread count query**

In `app/notifications/page.tsx`, after the existing `const { data: notifications } = await query;` line (line 36), add a parallel unread count query. The cleanest approach is to run both queries concurrently. Replace lines 24-38:

```tsx
  const base = supabase
    .from("notifications")
    .select("id, kind, title, body, href, created_at, read_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const kinds = category ? CATEGORY_KINDS[category] : null;
  const listQuery = kinds ? base.in("kind", kinds) : base;

  const countQuery = supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("read_at", null);

  const [{ data: notifications }, { count: unreadCount }] = await Promise.all([
    listQuery,
    countQuery,
  ]);

  const rows = notifications ?? [];
```

Then change line 82 from:

```tsx
hasUnread={rows.some((n) => !n.read_at)}
```

to:

```tsx
hasUnread={(unreadCount ?? 0) > 0}
```

Note: `countQuery` is NOT filtered by category — "Mark all read" should appear whenever there are ANY unread notifications, regardless of active filter. This matches the current behavior of `markAllRead()` which marks all unread (not filtered) as read.

- [ ] **Step 2: Test in browser**

1. Navigate to `/notifications`.
2. Verify "Mark all read" button appears when there are unread notifications.
3. If you can, create >50 notifications where the first 50 are read — verify "Mark all read" still appears.
4. Click "Mark all read" → button disappears, bell badge clears.
5. Verify filter pills still work correctly.

- [ ] **Step 3: Commit**

```bash
git add app/notifications/page.tsx
git commit -m "fix: use dedicated count query for hasUnread instead of checking fetched rows"
```

---

### Task 3: Make `markAllRead` Respect Active Category Filter

**Problem:** `markAllRead()` in `app/notifications/actions.ts` marks ALL unread notifications as read, even when the user is viewing a filtered category. If you're viewing "Offers" and click "Mark all read", it silently marks messages, deals, and campaigns as read too.

**Files:**
- Modify: `app/notifications/actions.ts:8-17` (add optional `kinds` parameter)
- Modify: `components/notifications/notification-list.tsx:4,52-57,68-69` (pass kinds to action)
- Modify: `app/notifications/page.tsx` (pass `activeKinds` to NotificationList)

**Interfaces:**
- Consumes: `markAllRead` action now accepts optional FormData with `kinds` field.
- Produces: `NotificationList` now accepts `activeKinds?: string[]` prop.

- [ ] **Step 1: Update `markAllRead` to accept an optional kinds filter**

In `app/notifications/actions.ts`, replace the `markAllRead` function:

```tsx
export async function markAllRead(formData?: FormData) {
  const { user } = await requireUser();
  const supabase = await createServerSupabase();
  let query = supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);

  const raw = formData?.get("kinds");
  if (typeof raw === "string" && raw.length > 0) {
    query = query.in("kind", raw.split(","));
  }

  await query;
  revalidatePath("/", "layout");
}
```

- [ ] **Step 2: Update `NotificationList` to pass `kinds` to the action**

In `components/notifications/notification-list.tsx`, update the props interface:

```tsx
export function NotificationList({
  notifications,
  hasUnread,
  activeKinds,
}: {
  notifications: NotificationRow[];
  hasUnread: boolean;
  activeKinds?: string[];
}) {
```

Then update the "Mark all read" form (the `{hasUnread && (` block):

```tsx
{hasUnread && (
  <form action={markAllRead} className="mt-4 flex justify-end">
    {activeKinds && (
      <input type="hidden" name="kinds" value={activeKinds.join(",")} />
    )}
    <Button type="submit" variant="outline" size="sm">
      Mark all read
    </Button>
  </form>
)}
```

- [ ] **Step 3: Pass `activeKinds` from the page**

In `app/notifications/page.tsx`, update the `NotificationList` call:

```tsx
<NotificationList
  notifications={rows}
  hasUnread={(unreadCount ?? 0) > 0}
  activeKinds={kinds ?? undefined}
/>
```

(`kinds` is the already-resolved `CATEGORY_KINDS[category]` array from the filter logic.)

- [ ] **Step 4: Test in browser**

1. Navigate to `/notifications?category=offers`.
2. Click "Mark all read".
3. Verify only offer/offer_response notifications are marked read.
4. Switch to "Messages" filter — verify message notifications are still unread.
5. Navigate to `/notifications` (no filter / "All") and click "Mark all read" — verify ALL notifications are marked read (no `kinds` filter applied).

- [ ] **Step 5: Commit**

```bash
git add app/notifications/actions.ts components/notifications/notification-list.tsx app/notifications/page.tsx
git commit -m "fix: markAllRead respects active category filter"
```

---

### Task 4: Make SiteNav Count Resilient to Auth Failures

**Problem:** `site-nav.tsx:31-40` uses `getClaims()` directly. If the JWT is expired or malformed, `sub` is undefined and `unread` silently falls to 0 — the bell badge disappears with no indication. Meanwhile `requireUser()` (which also uses `getClaims()` under the hood but redirects on failure) is already called by the page that renders SiteNav.

**Root cause:** SiteNav duplicates the auth check instead of receiving the user ID from its caller.

**Files:**
- Modify: `components/site-nav.tsx:8,30-41` (accept `userId` prop, drop redundant auth)
- Modify: Every page that renders `<SiteNav role={role} />` — add `userId={user.id}`

**Interfaces:**
- Consumes: `userId: string` prop (new).
- Produces: Same bell badge and `MobileNav` rendering.

- [ ] **Step 1: Find all SiteNav call sites**

```bash
grep -rn "<SiteNav" app/ components/ --include="*.tsx"
```

Record every file and line. Each needs updating.

- [ ] **Step 2: Update SiteNav to accept and use `userId`**

In `components/site-nav.tsx`, change the signature and remove the auth block:

```tsx
export async function SiteNav({ role, userId }: { role: "creator" | "brand" | "admin"; userId: string }) {
  const links =
    role === "creator"
      ? [
          { href: "/dashboard", label: "Dashboard" },
          { href: "/campaigns", label: "Campaigns" },
          { href: "/inbox", label: "Inbox" },
          { href: "/deals", label: "Deals" },
        ]
      : role === "admin"
        ? [
            { href: "/admin", label: "Admin" },
            { href: "/deals", label: "Deals" },
          ]
        : [
            { href: "/brand", label: "Brand home" },
            { href: "/discover", label: "Discover" },
            { href: "/campaigns", label: "Campaigns" },
            { href: "/inbox", label: "Inbox" },
            { href: "/deals", label: "Deals" },
          ];

  const supabase = await createServerSupabase();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  const unread = count ?? 0;
```

This removes `getClaims()` from SiteNav entirely. The `userId` comes from `requireUser()` which the caller already invokes — one auth check, no silent fallback to 0.

- [ ] **Step 3: Update all call sites**

Every `<SiteNav role={role} />` becomes `<SiteNav role={role} userId={user.id} />`.

The caller already has `const { user, role } = await requireUser(...)` so `user.id` is available. Update each file found in Step 1.

- [ ] **Step 4: Test in browser**

1. Navigate to any page with SiteNav (e.g., `/notifications`, `/dashboard`, `/deals`).
2. Verify bell badge still shows the correct unread count.
3. Verify mobile nav still shows badge on Alerts tab.
4. Log out → verify redirect to login (no stale badge with count 0).

- [ ] **Step 5: Commit**

```bash
git add components/site-nav.tsx app/
git commit -m "fix: pass userId to SiteNav instead of redundant getClaims call"
```

---

### Task Order

All 4 tasks are independent — they touch different lines/logic and can be executed in any order or in parallel.

Recommended batch: Tasks 1 + 4 (quick, self-contained), then Tasks 2 + 3 (both touch `page.tsx` so apply sequentially to avoid merge conflicts).

**Deferred:** Bug 5 (real-time notification updates via Supabase Realtime or polling) — this is a feature enhancement, not a bug fix. Add when users report stale counts as a problem in practice.
