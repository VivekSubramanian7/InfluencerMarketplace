# Notifications Quality — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the notifications page useful for triage — filter by category, scan by day, and control read state manually instead of losing it on page load.

**Architecture:** Three tasks modifying one page and adding one actions file. Tasks build on each other: Task 1 (filters) → Task 2 (timestamps/grouping) → Task 3 (manual read control). No new files beyond the actions file, no schema changes, no new dependencies.

**Tech Stack:** Next.js (App Router, Server Components), Supabase, Tailwind CSS, shadcn/ui

**Spec:** Bounded design approved in chat on 2026-09-02 (no separate spec file — three changes to existing notifications page).

## Global Constraints

- **Design system:** Follow `DESIGN.md` — Gallery Frame. Ink pills for primary actions, outlined pills for secondary. Cards use `rounded-2xl bg-card p-6 shadow-card`. Amber only for trust/attention states.
- **No new dependencies.** All changes use existing components and patterns.
- **No schema changes.**
- **Server Components by default.** Client components only where interactivity requires it.

---

### Task 1: Kind-Based Filter Pills

**Files:**
- Modify: `app/notifications/page.tsx:7` (extend searchParams type)
- Modify: `app/notifications/page.tsx:11-16` (apply filter to query)
- Modify: `app/notifications/page.tsx:32` (add filter nav below title)

**Interfaces:**
- Consumes: `searchParams.category` for filtering.
- Produces: Filtered notification list. No new exports.

**Kind → Category mapping:**

| Category | `kind` values |
|----------|--------------|
| Messages | `message`, `stale_thread`, `agent_digest` |
| Offers | `offer`, `offer_response` |
| Deals | `deal`, `booking` |
| Campaigns | `application`, `application_response`, `invite`, `invite_response` |

- [ ] **Step 1: Add the category mapping and extend searchParams**

In `app/notifications/page.tsx`, add the mapping above the component:

```tsx
const CATEGORY_KINDS: Record<string, string[]> = {
  messages: ["message", "stale_thread", "agent_digest"],
  offers: ["offer", "offer_response"],
  deals: ["deal", "booking"],
  campaigns: ["application", "application_response", "invite", "invite_response"],
};
```

Update the component signature to accept searchParams:

```tsx
export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { user, role } = await requireUser("/notifications");
  const { category } = await searchParams;
  const supabase = await createServerSupabase();
```

- [ ] **Step 2: Apply server-side filter to the query**

Replace the current notifications query (lines 11-16):

Current:
```tsx
const { data: notifications } = await supabase
  .from("notifications")
  .select("id, kind, title, body, href, created_at, read_at")
  .eq("user_id", user.id)
  .order("created_at", { ascending: false })
  .limit(50);
```

New:
```tsx
let query = supabase
  .from("notifications")
  .select("id, kind, title, body, href, created_at, read_at")
  .eq("user_id", user.id)
  .order("created_at", { ascending: false })
  .limit(50);

const kinds = category ? CATEGORY_KINDS[category] : null;
if (kinds) {
  query = query.in("kind", kinds);
}

const { data: notifications } = await query;
```

- [ ] **Step 3: Add filter pills below the page title**

After the `<h1>` tag (line 32), add:

```tsx
<nav className="mt-3 flex flex-wrap gap-1" aria-label="Filter notifications">
  {[
    { value: "all", label: "All" },
    { value: "messages", label: "Messages" },
    { value: "offers", label: "Offers" },
    { value: "deals", label: "Deals" },
    { value: "campaigns", label: "Campaigns" },
  ].map((f) => {
    const active = (category ?? "all") === f.value;
    return (
      <Link
        key={f.value}
        href={f.value === "all" ? "/notifications" : `/notifications?category=${f.value}`}
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

Same pattern as inbox filter pills — active filter uses ink pill, inactive use outlined secondary.

- [ ] **Step 4: Test in browser**

1. Navigate to `/notifications`.
2. Verify 5 filter pills appear below title: All (filled) | Messages | Offers | Deals | Campaigns.
3. Click "Offers" → URL becomes `/notifications?category=offers`, only offer-related notifications shown.
4. Click "All" → URL returns to `/notifications`, all notifications shown.
5. Verify empty state still works when a filtered category has no notifications.
6. Verify unread styling (amber ring, bold text, amber dot) still applies correctly.

- [ ] **Step 5: Commit**

```bash
git add app/notifications/page.tsx
git commit -m "feat: add category filter pills to notifications page"
```

---

### Task 2: Relative Timestamps + Day Grouping

**Files:**
- Modify: `app/notifications/page.tsx` (add timeAgo helper, group rows by day, render section headers)

**Interfaces:**
- Consumes: `notifications` list (already fetched).
- Produces: Grouped rendering with day headers. No new exports.

- [ ] **Step 1: Add date helpers**

At the top of `app/notifications/page.tsx`, before the component, add:

```tsx
function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = Math.floor((today.getTime() - target.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
```

- [ ] **Step 2: Group notifications by day**

After `const rows = notifications ?? [];`, add:

```tsx
const grouped = new Map<string, typeof rows>();
for (const n of rows) {
  const key = dayLabel(n.created_at);
  if (!grouped.has(key)) grouped.set(key, []);
  grouped.get(key)!.push(n);
}
```

- [ ] **Step 3: Update the rendering to use day sections**

Replace the current `<ul>` block (lines 40-81) with:

```tsx
<div className="mt-6 flex flex-col gap-6">
  {[...grouped.entries()].map(([day, items]) => (
    <section key={day}>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {day}
      </h2>
      <ul className="flex flex-col gap-2">
        {items.map((n) => {
          const inner = (
            <>
              <span className="flex min-w-0 flex-col">
                <span className={`truncate text-sm ${n.read_at ? "font-medium" : "font-bold"}`}>
                  {!n.read_at && (
                    <span aria-hidden className="mr-2 inline-block size-2 rounded-full bg-amber align-middle" />
                  )}
                  {n.title}
                </span>
                {n.body && (
                  <span className="mt-0.5 truncate text-sm text-muted-foreground">{n.body}</span>
                )}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {timeAgo(n.created_at)}
              </span>
            </>
          );
          return (
            <li key={n.id}>
              {n.href ? (
                <Link
                  href={n.href}
                  className={`deal-row flex items-center justify-between gap-4 rounded-2xl p-4 transition-all hover:-translate-y-0.5 hover:shadow-card-hover ${
                    n.read_at ? "bg-card shadow-card" : "bg-card shadow-card ring-1 ring-amber/20"
                  }`}
                >
                  {inner}
                </Link>
              ) : (
                <div className={`flex items-center justify-between gap-4 rounded-2xl p-4 ${
                  n.read_at ? "bg-card shadow-card" : "bg-card shadow-card ring-1 ring-amber/20"
                }`}>
                  {inner}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  ))}
</div>
```

Changes:
- Notifications grouped under "Today", "Yesterday", "Sep 1" etc. headers.
- `toLocaleDateString()` timestamp replaced with relative `timeAgo()`.
- Day headers use the same muted uppercase style as other section labels in the app.

- [ ] **Step 4: Test in browser**

1. Navigate to `/notifications`.
2. Verify notifications are grouped under day headers (Today, Yesterday, etc.).
3. Verify timestamps show relative times ("2h ago", "yesterday", "3d ago").
4. Verify today's notifications show under "Today" header.
5. Verify grouping works correctly with filters active (e.g., filter to "Offers" then check day headers).
6. Verify empty state still renders when no notifications exist.

- [ ] **Step 5: Commit**

```bash
git add app/notifications/page.tsx
git commit -m "feat: add relative timestamps and day grouping to notifications"
```

---

### Task 3: Manual Read Control

**Files:**
- Create: `app/notifications/actions.ts` (server actions for mark-read)
- Modify: `app/notifications/page.tsx` (remove auto-mark-all, add mark-all button, add per-item mark-read)
- Create: `components/notifications/notification-list.tsx` (client component for interactive mark-read)

**Interfaces:**
- Consumes: `markAllRead` and `markRead` server actions.
- Produces: `NotificationList` client component. `markAllRead` and `markRead` exported server actions.

- [ ] **Step 1: Create server actions**

Create `app/notifications/actions.ts`:

```tsx
"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";

export async function markAllRead() {
  const { user } = await requireUser();
  const supabase = await createServerSupabase();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);
  revalidatePath("/notifications");
}

export async function markRead(formData: FormData) {
  const { user } = await requireUser();
  const supabase = await createServerSupabase();
  const id = String(formData.get("id") ?? "");
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  revalidatePath("/notifications");
}
```

- [ ] **Step 2: Remove auto-mark-all from the page**

In `app/notifications/page.tsx`, delete the auto-mark block (lines 20-24):

```tsx
// DELETE THIS:
await supabase
  .from("notifications")
  .update({ read_at: new Date().toISOString() })
  .eq("user_id", user.id)
  .is("read_at", null);
```

- [ ] **Step 3: Create the NotificationList client component**

Create `components/notifications/notification-list.tsx`:

```tsx
"use client";

import Link from "next/link";
import { markAllRead, markRead } from "@/app/notifications/actions";
import { Button } from "@/components/ui/button";

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = Math.floor((today.getTime() - target.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export interface NotificationRow {
  id: number;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  created_at: string;
  read_at: string | null;
}

export function NotificationList({
  notifications,
  hasUnread,
}: {
  notifications: NotificationRow[];
  hasUnread: boolean;
}) {
  const grouped = new Map<string, NotificationRow[]>();
  for (const n of notifications) {
    const key = dayLabel(n.created_at);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(n);
  }

  return (
    <>
      {hasUnread && (
        <form action={markAllRead} className="mt-4 flex justify-end">
          <Button type="submit" variant="outline" size="sm">
            Mark all read
          </Button>
        </form>
      )}
      <div className="mt-4 flex flex-col gap-6">
        {[...grouped.entries()].map(([day, items]) => (
          <section key={day}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {day}
            </h2>
            <ul className="flex flex-col gap-2">
              {items.map((n) => (
                <li key={n.id} className="group relative">
                  {n.href ? (
                    <Link
                      href={n.href}
                      className={`deal-row flex items-center justify-between gap-4 rounded-2xl p-4 transition-all hover:-translate-y-0.5 hover:shadow-card-hover ${
                        n.read_at ? "bg-card shadow-card" : "bg-card shadow-card ring-1 ring-amber/20"
                      }`}
                    >
                      <NotificationInner n={n} />
                    </Link>
                  ) : (
                    <div
                      className={`flex items-center justify-between gap-4 rounded-2xl p-4 ${
                        n.read_at ? "bg-card shadow-card" : "bg-card shadow-card ring-1 ring-amber/20"
                      }`}
                    >
                      <NotificationInner n={n} />
                    </div>
                  )}
                  {!n.read_at && (
                    <form
                      action={markRead}
                      className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <input type="hidden" name="id" value={n.id} />
                      <button
                        type="submit"
                        className="rounded-full p-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
                        aria-label="Mark as read"
                        title="Mark as read"
                      >
                        ✓
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}

function NotificationInner({ n }: { n: NotificationRow }) {
  return (
    <>
      <span className="flex min-w-0 flex-col">
        <span className={`truncate text-sm ${n.read_at ? "font-medium" : "font-bold"}`}>
          {!n.read_at && (
            <span aria-hidden className="mr-2 inline-block size-2 rounded-full bg-amber align-middle" />
          )}
          {n.title}
        </span>
        {n.body && (
          <span className="mt-0.5 truncate text-sm text-muted-foreground">{n.body}</span>
        )}
      </span>
      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
        {timeAgo(n.created_at)}
      </span>
    </>
  );
}
```

Design notes:
- "Mark all read" button appears only when there are unread notifications, aligned right.
- Per-notification "✓" button appears on hover (top-right corner), uses `group-hover:opacity-100`.
- Both call server actions that revalidate the page.

- [ ] **Step 4: Update the server page to use NotificationList**

In `app/notifications/page.tsx`, replace the entire notification rendering (the `<ul>` or grouped `<div>` block) with:

```tsx
import { NotificationList } from "@/components/notifications/notification-list";
```

And in the JSX, replace the notification list section with:

```tsx
{rows.length === 0 ? (
  <div className="mt-6 rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
    <span aria-hidden className="mx-auto mb-3 block w-fit text-muted-foreground/40"><BellIcon size={36} /></span>
    <p className="font-semibold text-foreground">All caught up</p>
    <p className="mt-1">Invites, offers, and deal updates land here.</p>
  </div>
) : (
  <NotificationList
    notifications={rows}
    hasUnread={rows.some((n) => !n.read_at)}
  />
)}
```

Remove from the server page:
- The `timeAgo` and `dayLabel` helpers (now in the client component).
- The inline notification row rendering (now in `NotificationList`).
- The auto-mark-all-read block (deleted in Step 2).

The server page now just fetches data, renders the filter pills + title, and passes everything to `NotificationList`.

- [ ] **Step 5: Test in browser**

1. Navigate to `/notifications` with some unread notifications.
2. Verify unread notifications keep their amber styling — page load does NOT mark them read.
3. Verify "Mark all read" button appears in the top-right area.
4. Click "Mark all read" → all amber dots disappear, button disappears, bell badge in nav clears.
5. Create a new notification (e.g., send a message) and revisit → unread styling reappears.
6. Hover over an unread notification → "✓" button appears at top-right.
7. Click "✓" → that notification loses amber styling, others remain unread.
8. Verify filters still work with the new component.
9. Verify day grouping and relative timestamps render correctly.
10. Verify the bell badge count in site-nav stays accurate (it queries `read_at IS NULL` directly).

- [ ] **Step 6: Commit**

```bash
git add app/notifications/actions.ts components/notifications/notification-list.tsx app/notifications/page.tsx
git commit -m "feat: replace auto-mark-all with manual read control on notifications"
```

---

### Task Order

Tasks modify the same page and build on each other:
1. **Task 1** adds filter pills (modifies query and layout).
2. **Task 2** adds day grouping and relative timestamps (modifies rendering).
3. **Task 3** extracts rendering into a client component and adds read control (refactors Task 2's rendering).

**Recommended sequence:** Task 1 → Task 2 → Task 3.

Note: Task 2 is intermediate — its inline rendering gets extracted into a client component by Task 3. If implementing all at once, you could combine Tasks 2 and 3. If implementing incrementally, Task 2 works standalone (server-rendered grouping) and Task 3 then adds interactivity.
