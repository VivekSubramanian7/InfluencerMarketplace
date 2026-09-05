# Distributed Unread Indicators Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the centralized `notifications` table with per-feature unread dots derived from real data, preserve email alerts, and delete all notification-only code.

**Architecture:** A `feature_cursors` table stores `(user_id, feature, seen_at)`. The app shell queries each feature's latest activity timestamp and compares it to the cursor — if activity is newer, the nav item gets an amber dot. Email delivery moves to a standalone `lib/email.ts`. All notification code (table, UI, cron, `notify()` calls) is deleted.

**Tech Stack:** Supabase (Postgres), Next.js server components/actions, Resend (email)

**Spec:** Design approved in conversation — no separate spec file.

## Global Constraints

- Migration sequence: next available is `0024`.
- Migration `0019` contains three tables (`notifications`, `brand_ingestions`, `agent_drafts`) — only the `notifications` portion is removed; the other two stay.
- All UI follows `DESIGN.md` workspace register (dense, flat, 8px radius, no shadow-card).
- Existing tests, if any, must keep passing. Run `pnpm build` to verify no type errors after changes.

---

### Task 1: Database — `feature_cursors` table + drop `notifications`

**Files:**
- Create: `supabase/migrations/0024_distributed_unread.sql`
- Modify: `supabase/.temp/seed.sql:405-424` (delete notification seed rows)

**Interfaces:**
- Produces: `feature_cursors` table with columns `(user_id uuid, feature text, seen_at timestamptz)`, PK `(user_id, feature)`. RLS: users read/upsert own rows only. Features are plain strings: `'inbox'`, `'deals'`, `'campaigns'`.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/0024_distributed_unread.sql`:

```sql
-- Distributed unread indicators: per-feature "last seen" cursors replace
-- the centralized notifications table.

create table public.feature_cursors (
  user_id uuid not null references public.profiles(id) on delete cascade,
  feature text not null check (length(feature) between 1 and 30),
  seen_at timestamptz not null default now(),
  primary key (user_id, feature)
);
alter table public.feature_cursors enable row level security;

create policy "users read own cursors"
  on public.feature_cursors for select
  using ((select auth.uid()) = user_id);
create policy "users upsert own cursors"
  on public.feature_cursors for insert
  with check ((select auth.uid()) = user_id);
create policy "users update own cursors"
  on public.feature_cursors for update
  using ((select auth.uid()) = user_id);

grant select, insert, update on table public.feature_cursors to authenticated;
grant select, insert, update, delete on table public.feature_cursors to service_role;

-- Drop the notifications table. brand_ingestions and agent_drafts (same
-- migration 0019) stay — only notifications is removed.
drop policy if exists "users read own notifications" on public.notifications;
drop policy if exists "users mark own notifications read" on public.notifications;
drop index if exists notifications_unread_idx;
drop index if exists notifications_user_idx;
drop table if exists public.notifications;
```

- [ ] **Step 2: Remove notification seed data from `supabase/.temp/seed.sql`**

Delete the entire section from the comment `-- 11. Notifications` through the closing `;` of the notification insert (lines 406–424). Leave surrounding sections intact.

- [ ] **Step 3: Verify migration applies**

Run: `pnpm supabase db reset` (or `supabase db reset` if using the CLI directly).
Expected: clean reset with no errors. The `notifications` table should no longer exist; `feature_cursors` should exist; `brand_ingestions` and `agent_drafts` should still exist.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0024_distributed_unread.sql supabase/.temp/seed.sql
git commit -m "feat: add feature_cursors table, drop notifications table"
```

---

### Task 2: Extract email into `lib/email.ts`

**Files:**
- Create: `lib/email.ts`
- Read (reference only): `lib/notify.ts` (for the Resend integration pattern)

**Interfaces:**
- Produces: `sendEmail({ to: string, subject: string, text: string }): Promise<void>` — fire-and-forget, best-effort, uses `RESEND_API_KEY` and `EMAIL_FROM` env vars. No-ops if `RESEND_API_KEY` is unset. Never throws.

- [ ] **Step 1: Create `lib/email.ts`**

```typescript
import "server-only";

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "Clipline <onboarding@resend.dev>",
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
    });
  } catch (err) {
    console.error("sendEmail failed:", err);
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add lib/email.ts
git commit -m "feat: extract standalone sendEmail helper from notify"
```

---

### Task 3: Create `lib/feature-cursors.ts` — unread queries + cursor touch

**Files:**
- Create: `lib/feature-cursors.ts`

**Interfaces:**
- Consumes: Supabase client from `@/lib/supabase/server`
- Produces:
  - `touchCursor(feature: string): Promise<void>` — upserts `seen_at = now()` for the current user + feature. Call from page-level server components.
  - `getUnreadFlags(userId: string, role: "creator" | "brand" | "admin"): Promise<{ inbox: boolean; deals: boolean; campaigns: boolean }>` — returns booleans per feature. Used by the app shell.

- [ ] **Step 1: Create `lib/feature-cursors.ts`**

```typescript
import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";

type UnreadFlags = { inbox: boolean; deals: boolean; campaigns: boolean };

export async function getUnreadFlags(
  userId: string,
  role: "creator" | "brand" | "admin",
): Promise<UnreadFlags> {
  const supabase = await createServerSupabase();

  const { data: cursors } = await supabase
    .from("feature_cursors")
    .select("feature, seen_at")
    .eq("user_id", userId);

  const cursorMap = new Map(
    (cursors ?? []).map((c) => [c.feature, c.seen_at]),
  );

  const since = (feature: string) => cursorMap.get(feature) ?? "1970-01-01T00:00:00Z";

  // Inbox: any message (in conversations) or conversation status change
  // newer than the cursor. For creators, also count pending invites.
  const inboxP = (async () => {
    const sinceInbox = since("inbox");

    // New messages in the user's conversations
    const { count: newMessages } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .not("sender_id", "eq", userId)
      .gt("created_at", sinceInbox)
      .not("conversation_id", "is", null);

    if ((newMessages ?? 0) > 0) return true;

    // Pending invites (creator only) or new conversations (brand sees
    // accepted responses)
    if (role === "creator") {
      const { count } = await supabase
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("creator_id", userId)
        .eq("status", "invited")
        .gt("created_at", sinceInbox);
      return (count ?? 0) > 0;
    }

    // Brand: new accepted/declined responses
    const { count } = await supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", userId)
      .not("status", "eq", "invited")
      .gt("responded_at", sinceInbox);
    return (count ?? 0) > 0;
  })();

  // Deals: any deal event (state change, message) newer than the cursor
  const dealsP = (async () => {
    const sinceDeals = since("deals");

    // Deal state changes via deal_events
    const { count: newEvents } = await supabase
      .from("deal_events")
      .select("id", { count: "exact", head: true })
      .not("actor", "eq", userId)
      .gt("created_at", sinceDeals);
    // RLS on deal_events already limits to participant's deals

    if ((newEvents ?? 0) > 0) return true;

    // New messages on deals
    const { count: newDealMessages } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .not("sender_id", "eq", userId)
      .gt("created_at", sinceDeals)
      .not("deal_id", "is", null);

    return (newDealMessages ?? 0) > 0;
  })();

  // Campaigns: for brands — new applications; for creators — application
  // status changes (accepted/declined)
  const campaignsP = (async () => {
    const sinceCampaigns = since("campaigns");

    if (role === "brand") {
      // New applications on brand's campaigns
      const { count } = await supabase
        .from("campaign_applications")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .gt("created_at", sinceCampaigns);
      // RLS limits to applications on this brand's campaigns
      return (count ?? 0) > 0;
    }

    // Creator: application status changed (accepted or declined)
    const { count } = await supabase
      .from("campaign_applications")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", userId)
      .in("status", ["accepted", "declined"])
      .gt("created_at", sinceCampaigns);
    return (count ?? 0) > 0;
  })();

  const [inbox, deals, campaigns] = await Promise.all([
    inboxP,
    dealsP,
    campaignsP,
  ]);

  return { inbox, deals, campaigns };
}

export async function touchCursor(feature: string): Promise<void> {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("feature_cursors").upsert(
    { user_id: user.id, feature, seen_at: new Date().toISOString() },
    { onConflict: "user_id,feature" },
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm tsc --noEmit`
Expected: no new errors (the `feature_cursors` table type may need a regeneration of Supabase types — run `pnpm supabase gen types typescript --local > lib/supabase/database.types.ts` or equivalent if types are auto-generated).

- [ ] **Step 3: Commit**

```bash
git add lib/feature-cursors.ts
git commit -m "feat: add feature cursor queries and touch helper"
```

---

### Task 4: Rewire app shell — replace notification count with unread flags

**Files:**
- Modify: `lib/app-shell/data.ts` — replace `unreadNotifications` query with `getUnreadFlags()` call
- Modify: `components/app-shell.tsx` — pass new props to MobileNav, remove `unreadNotifications`
- Modify: `components/app-rail.tsx` — remove `/notifications` nav item, add dots to Inbox/Deals/Campaigns
- Modify: `components/mobile-nav.tsx` — remove Alerts tab, add dots to Inbox/Deals/Campaigns

**Interfaces:**
- Consumes: `getUnreadFlags()` from `lib/feature-cursors.ts`, `getAppShellData()` return type
- Produces: Updated `AppRailProps` type (removes `unreadNotifications`, adds `unreadDeals: boolean`, `unreadCampaigns: boolean`). `unreadInbox` stays as-is (already exists) but becomes a boolean.

- [ ] **Step 1: Update `lib/app-shell/data.ts`**

Replace the `notifications` count query with `getUnreadFlags`. The function currently runs 6 parallel queries. Replace the first one (`unreadNotifications`) with the `getUnreadFlags` call:

```typescript
import { createServerSupabase } from "@/lib/supabase/server";
import { getUnreadFlags } from "@/lib/feature-cursors";
import type { Role } from "@/lib/auth/home";

export async function getAppShellData(userId: string, role: Role) {
  const supabase = await createServerSupabase();
  const [
    unreadFlags,
    { data: profile },
    brandProfileRes,
    creatorProfileRes,
    { data: authData },
  ] = await Promise.all([
    role === "admin"
      ? Promise.resolve({ inbox: false, deals: false, campaigns: false })
      : getUnreadFlags(userId, role),
    supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
    role === "brand"
      ? supabase.from("brand_profiles").select("company").eq("user_id", userId).maybeSingle()
      : Promise.resolve({ data: null as { company: string } | null }),
    role === "creator"
      ? supabase.from("creator_profiles").select("handle").eq("user_id", userId).maybeSingle()
      : Promise.resolve({ data: null as { handle: string } | null }),
    supabase.auth.getUser(),
  ]);

  const brandProfile = brandProfileRes.data;
  const creatorProfile = creatorProfileRes.data;

  const workspaceName =
    role === "brand"
      ? brandProfile?.company ?? profile?.display_name ?? "Your brand"
      : role === "creator"
        ? profile?.display_name ??
          (creatorProfile?.handle ? `@${creatorProfile.handle}` : "Your studio")
        : "Admin";

  return {
    role,
    userId,
    unreadInbox: unreadFlags.inbox,
    unreadDeals: unreadFlags.deals,
    unreadCampaigns: unreadFlags.campaigns,
    displayName: profile?.display_name ?? null,
    email: authData.user?.email ?? "",
    workspaceName,
    workspaceRole: role as "creator" | "brand" | "admin",
  };
}
```

Note: `unreadInbox` changes from `number` to `boolean`. This is intentional — all downstream consumers only check `> 0`.

- [ ] **Step 2: Update `components/app-rail.tsx`**

Change `AppRailProps`:
- Remove `unreadNotifications: number`
- Change `unreadInbox: number` → `unreadInbox: boolean`
- Add `unreadDeals: boolean` and `unreadCampaigns: boolean`

Update the nav items:
- Remove the `{ href: "/notifications", ... }` entry from the `utility` array
- Add `badge` to Deals and Campaigns in `core` array (using booleans)
- Change the badge rendering from a count pill to a plain dot for booleans

Replace the full `AppRailProps` type:

```typescript
export type AppRailProps = {
  role: "creator" | "brand" | "admin";
  userId: string;
  unreadInbox: boolean;
  unreadDeals: boolean;
  unreadCampaigns: boolean;
  displayName: string | null;
  email: string;
  workspaceName: string;
  workspaceRole: "creator" | "brand" | "admin";
};
```

Update the destructuring in `AppRail` to use the new props. Update the `core` array:

```typescript
const core: NavItem[] = [
  { href: "/inbox", label: "Inbox", icon: MessageIcon, badge: unreadInbox ? 1 : 0 },
  { href: "/deals", label: "Deals", icon: HandshakeIcon, badge: unreadDeals ? 1 : 0 },
  { href: "/campaigns", label: "Campaigns", icon: CampaignsIcon, badge: unreadCampaigns ? 1 : 0 },
];
```

Update the `utility` array — remove the `/notifications` entry entirely:

```typescript
const utility: NavItem[] = [
  {
    href: role === "brand" ? "/brand/settings" : "/dashboard?tab=profile",
    label: "Settings",
    icon: DashboardIcon,
  },
];
```

Change the badge rendering from a count pill to a dot. In `renderItem`, replace the badge `<span>`:

```typescript
{item.badge != null && item.badge > 0 && (
  <span
    aria-hidden
    className="size-2 rounded-full bg-amber"
  />
)}
```

Remove the `BellIcon` import from the icons import line.

- [ ] **Step 3: Update `components/mobile-nav.tsx`**

Remove `BellIcon` from imports. Change `CREATOR_TABS` and `BRAND_TABS` to remove the Alerts tab and add `unread` flags to Deals and Campaigns:

```typescript
const CREATOR_TABS = [
  { href: "/dashboard", label: "Studio", icon: DashboardIcon },
  { href: "/inbox", label: "Inbox", icon: MessageIcon, key: "inbox" as const },
  { href: "/deals", label: "Deals", icon: HandshakeIcon, key: "deals" as const },
  { href: "/campaigns", label: "Campaigns", icon: CampaignsIcon, key: "campaigns" as const },
] as const;

const BRAND_TABS = [
  { href: "/brand", label: "Home", icon: HomeIcon },
  { href: "/discover", label: "Discover", icon: SearchIcon },
  { href: "/inbox", label: "Inbox", icon: MessageIcon, key: "inbox" as const },
  { href: "/deals", label: "Deals", icon: HandshakeIcon, key: "deals" as const },
] as const;
```

Update the `MobileNav` props and badge logic:

```typescript
export function MobileNav({
  role,
  unreadInbox = false,
  unreadDeals = false,
  unreadCampaigns = false,
}: {
  role: "creator" | "brand" | "admin";
  unreadInbox?: boolean;
  unreadDeals?: boolean;
  unreadCampaigns?: boolean;
}) {
  const pathname = usePathname();
  if (role === "admin") return null;

  const tabs = role === "creator" ? CREATOR_TABS : BRAND_TABS;
  const flagMap: Record<string, boolean> = {
    inbox: unreadInbox,
    deals: unreadDeals,
    campaigns: unreadCampaigns,
  };

  return (
    <nav
      className="mobile-nav fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-[var(--card)]/95 backdrop-blur-md md:hidden"
      aria-label="Mobile navigation"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around">
        {tabs.map((tab) => {
          const active = tabActive(pathname, tab.href);
          const Icon = tab.icon;
          const hasUnread = "key" in tab ? flagMap[tab.key] ?? false : false;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                className={`mobile-tab relative flex flex-col items-center justify-center gap-0.5 py-2 transition-colors ${
                  active ? "text-[var(--ink)]" : "text-[var(--muted-foreground)]"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <span className="relative">
                  <Icon size={24} strokeWidth={active ? 2.5 : 1.5} aria-hidden />
                  {hasUnread && (
                    <span
                      aria-hidden
                      className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-amber"
                    />
                  )}
                </span>
                <span className={`text-[10px] leading-tight ${active ? "font-semibold" : "font-medium"}`}>
                  {tab.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 4: Update `components/app-shell.tsx`**

Pass the new boolean props to `MobileNav` instead of the old count-based ones:

```typescript
export function AppShell({
  children,
  pane,
  ...railProps
}: {
  children: ReactNode;
  pane?: ReactNode;
} & AppRailProps) {
  return (
    <div className="flex h-dvh bg-[var(--ground)]">
      <div className="hidden md:block">
        <AppRail {...railProps} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col p-2 md:p-3">
        <div className="flex min-h-0 flex-1 overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--card)]">
          <div className="min-w-0 flex-1 overflow-y-auto p-6 pb-24 md:pb-6">
            {children}
          </div>
          {pane ? (
            <aside className="hidden w-[min(42%,28rem)] shrink-0 overflow-y-auto border-l border-[var(--border)] lg:block">
              {pane}
            </aside>
          ) : null}
        </div>
      </div>
      <MobileNav
        role={railProps.role}
        unreadInbox={railProps.unreadInbox}
        unreadDeals={railProps.unreadDeals}
        unreadCampaigns={railProps.unreadCampaigns}
      />
    </div>
  );
}
```

- [ ] **Step 5: Verify it compiles**

Run: `pnpm tsc --noEmit`
Expected: no errors. If other pages reference `unreadNotifications` from `getAppShellData`, they will error here — fix them in this step.

- [ ] **Step 6: Commit**

```bash
git add lib/app-shell/data.ts components/app-shell.tsx components/app-rail.tsx components/mobile-nav.tsx
git commit -m "feat: replace notification badges with per-feature unread dots"
```

---

### Task 5: Touch cursors from feature pages

**Files:**
- Modify: `app/inbox/page.tsx` — add `touchCursor("inbox")` call
- Modify: `app/inbox/[id]/page.tsx` — add `touchCursor("inbox")` call
- Modify: `app/deals/page.tsx` — add `touchCursor("deals")` call
- Modify: `app/deals/[id]/page.tsx` — add `touchCursor("deals")` call
- Modify: `app/campaigns/page.tsx` — add `touchCursor("campaigns")` call
- Modify: `app/campaigns/[id]/page.tsx` — add `touchCursor("campaigns")` call

**Interfaces:**
- Consumes: `touchCursor(feature: string)` from `lib/feature-cursors.ts`

- [ ] **Step 1: Add cursor touch to each page**

In each of the six files listed above, add this import at the top:

```typescript
import { touchCursor } from "@/lib/feature-cursors";
```

Then, inside the `default export async function` body, immediately after the `requireUser` / `requireRole` call, add the cursor touch. The feature name matches the route:

For `app/inbox/page.tsx` and `app/inbox/[id]/page.tsx`:
```typescript
await touchCursor("inbox");
```

For `app/deals/page.tsx` and `app/deals/[id]/page.tsx`:
```typescript
await touchCursor("deals");
```

For `app/campaigns/page.tsx` and `app/campaigns/[id]/page.tsx`:
```typescript
await touchCursor("campaigns");
```

Place each call on the line after `requireUser`/`requireRole` and before the `searchParams` destructure or Supabase queries. This is a fire-and-forget upsert and is fast enough to run inline (single indexed upsert).

- [ ] **Step 2: Verify it compiles**

Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/inbox/page.tsx app/inbox/\[id\]/page.tsx app/deals/page.tsx app/deals/\[id\]/page.tsx app/campaigns/page.tsx app/campaigns/\[id\]/page.tsx
git commit -m "feat: touch feature cursors on page visit"
```

---

### Task 6: Replace `notify()` calls with `sendEmail()` where needed

**Files:**
- Modify: `app/inbox/actions.ts` — remove 5 `notify()` calls; add `sendEmail()` for the 2 that had `email: true`
- Modify: `app/deals/[id]/actions.ts` — remove 1 `notify()` call; add `sendEmail()` (had `email: true`)
- Modify: `app/deals/[id]/message-actions.ts` — remove 1 `notify()` call (no email)
- Modify: `app/campaigns/[id]/actions.ts` — remove 5 `notify()` calls; add `sendEmail()` for the 3 that had `email: true`
- Modify: `app/c/[handle]/actions.ts` — remove 1 `notify()` call; add `sendEmail()` (had `email: true`)
- Modify: `app/discover/actions.ts` — remove 2 `notify()` calls; add `sendEmail()` (had `email: true`)
- Modify: `app/book/[offeringId]/actions.ts` — remove 1 `notify()` call; add `sendEmail()` (had `email: true`)

**Interfaces:**
- Consumes: `sendEmail({ to, subject, text })` from `lib/email.ts`

The pattern is: every `notify()` call is deleted. Where the call had `email: true`, we replace it with `sendEmail()`. Where it didn't have `email: true`, we just delete the call and its surrounding code (the `if (conv)` guard, the profile lookup, etc.) — unless the profile lookup is still needed for the email.

For email calls, we need the recipient's email address. The current `notify()` fetches it inside via `service.auth.admin.getUserById()`. Since we don't have service-role access in action files, we instead look up the email from the `auth.users` table via `supabase.auth.admin` — but that requires the service client. The simpler approach: fetch the user's email from Supabase auth in the action.

Actually, looking at the existing code more carefully: `notify()` used the service client internally. The action files don't have service-role access. So we need a helper that resolves a user ID to an email. Let's add that to `lib/email.ts`.

- [ ] **Step 1: Add `emailUserById` helper to `lib/email.ts`**

Append to `lib/email.ts`:

```typescript
import { createServiceClient } from "@/lib/supabase/service";

export async function emailUser(opts: {
  userId: string;
  subject: string;
  text: string;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;
  try {
    const service = createServiceClient();
    const { data } = await service.auth.admin.getUserById(opts.userId);
    const to = data.user?.email;
    if (!to) return;
    await sendEmail({ to, subject: opts.subject, text: opts.text });
  } catch (err) {
    console.error("emailUser failed:", err);
  }
}
```

This keeps the pattern identical to what `notify()` did: service-role lookup for email, then send. Fire-and-forget, never throws.

Also update the top of `lib/email.ts` — the `"server-only"` import stays, add the service import:

```typescript
import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  // ... (unchanged from Task 2)
}

export async function emailUser(opts: {
  userId: string;
  subject: string;
  text: string;
}): Promise<void> {
  // ... (as above)
}
```

- [ ] **Step 2: Update `app/inbox/actions.ts`**

Replace `import { notify } from "@/lib/notify"` with `import { emailUser } from "@/lib/email"`.

**`respondInvite`** (line 37–43): The `notify()` call had `email: response === "accepted"`. Replace:

```typescript
// Before (delete):
await notify({
  userId: updated.brand_id,
  kind: "invite_response",
  title: `${me?.display_name || "A creator"} ${response === "accepted" ? "accepted your invite" : "declined your invite"}`,
  href: response === "accepted" ? `/inbox/${id}` : "/inbox",
  email: response === "accepted",
});

// After:
if (response === "accepted") {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  emailUser({
    userId: updated.brand_id,
    subject: `${me?.display_name || "A creator"} accepted your invite`,
    text: `Open it on Clipline: ${site}/inbox/${id}`,
  });
}
```

Note: `emailUser` is fire-and-forget, no `await` needed. But keeping `await` is fine since the original `notify` was awaited. Either way is acceptable — prefer `await` for consistency.

**`sendThreadMessage`** (line 84–92): No email. Delete the entire block:

```typescript
// Delete this block:
const { data: conv } = await supabase
  .from("conversations")
  .select("brand_id, creator_id")
  .eq("id", conversationId)
  .maybeSingle();
if (conv) {
  await notify({ ... });
}
```

**`sendOffer`** (line 133–143): Had `email: true`. Replace the `notify()` block:

```typescript
// Delete the notify block. Replace with:
if (conv) {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  await emailUser({
    userId: conv.creator_id,
    subject: `You have an offer: $${(price! / 100).toFixed(2)}`,
    text: `Open it on Clipline: ${site}/inbox/${conversationId}`,
  });
}
```

Keep the `conv` lookup since it's used for the email.

**`respondOffer` — accepted path** (line 174–182): Had `email: true`. Replace:

```typescript
if (conv) {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  await emailUser({
    userId: conv.brand_id,
    subject: "Your offer was accepted — the deal has started",
    text: `Open it on Clipline: ${site}/deals/${dealId}`,
  });
}
```

**`respondOffer` — declined path** (line 194–201): No email. Delete the entire `if (conv) { await notify(...) }` block. The `conv` lookup (line 156–157) is only used for `notify` — also delete it if no other code uses `conv` in this branch. Check: `conv.brand_id` is used in both the accepted and declined branches. Since the accepted branch still needs it, keep the lookup. But the declined branch no longer needs it — the lookup is before the `if (response === "accepted")` branch, so it stays (it's shared).

- [ ] **Step 3: Update `app/deals/[id]/actions.ts`**

Replace `import { notify } from "@/lib/notify"` with `import { emailUser } from "@/lib/email"`.

**`performDealAction`** (line 76–83): Had `email: true`. Replace the `notify()` block:

```typescript
if (deal) {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  await emailUser({
    userId: role === "brand" ? deal.creator_id : deal.brand_id,
    subject: `${ACTION_TITLES[action] ?? "Deal updated"} · ${deal.offering_title}`,
    text: `Open it on Clipline: ${site}/deals/${dealId}`,
  });
  // ... trackServerEvent stays unchanged
}
```

- [ ] **Step 4: Update `app/deals/[id]/message-actions.ts`**

Remove the `import { notify } from "@/lib/notify"` line entirely (no emails for deal messages).

Delete the entire block that looks up `deal` and calls `notify()` (lines 30–40):

```typescript
// Delete:
const { data: deal } = await supabase
  .from("deals").select("brand_id, creator_id").eq("id", dealId).maybeSingle();
if (deal) {
  await notify({ ... });
}
```

- [ ] **Step 5: Update `app/campaigns/[id]/actions.ts`**

Replace `import { notify } from "@/lib/notify"` with `import { emailUser } from "@/lib/email"`.

**`applyToCampaign`** (line 59–66): No email. Delete the `if (campaign) { await notify(...) }` block.

**`decideApplication` — accepted** (line 115–122): Had `email: true`. Replace:

```typescript
if (app) {
  // ... trackServerEvent stays
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  await emailUser({
    userId: app.creator_id,
    subject: "Your campaign application was accepted — the deal has started",
    text: `Open it on Clipline: ${site}/deals/${dealId}`,
  });
}
```

**`decideApplication` — declined** (line 141–146): No email. Delete the `await notify(...)` call.

**`bulkDecideApplications` — accepted loop** (line 181–188): Had `email: true`. Replace the `notify()` call:

```typescript
const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
await emailUser({
  userId: app.creator_id,
  subject: "Your campaign application was accepted — the deal has started",
  text: `Open it on Clipline: ${site}/campaigns/${campaignId}`,
});
```

**`bulkDecideApplications` — declined loop** (line 200–206): No email. Delete the `notify()` call inside `else if (declined)`.

- [ ] **Step 6: Update `app/c/[handle]/actions.ts`**

Replace `import { notify } from "@/lib/notify"` with `import { emailUser } from "@/lib/email"`.

**`inviteFromStorefront`** (line 56–63): Had `email: true`. Replace:

```typescript
const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
await emailUser({
  userId: creatorId,
  subject: `${brandLabel} wants to work with you`,
  text: `${message}\n\nOpen it on Clipline: ${site}/inbox`,
});
```

- [ ] **Step 7: Update `app/discover/actions.ts`**

Replace `import { notify } from "@/lib/notify"` with `import { emailUser } from "@/lib/email"`.

**`sendReachouts` loop** (line 48–56): Had `email: true`. Replace the `notify()` call:

```typescript
const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
await emailUser({
  userId: creatorId,
  subject: `${brandLabel} wants to work with you`,
  text: `${message}\n\nOpen it on Clipline: ${site}/inbox`,
});
```

Move the `site` const outside the loop (before `for (const creatorId of creatorIds)`).

- [ ] **Step 8: Update `app/book/[offeringId]/actions.ts`**

Replace `import { notify } from "@/lib/notify"` with `import { emailUser } from "@/lib/email"`.

**`createBooking`** (line 70–76): Had `email: true`. Replace:

```typescript
const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
await emailUser({
  userId: offering.creator_id,
  subject: `New booking request: ${offering.title}`,
  text: `Open it on Clipline: ${site}/deals/${deal.id}`,
});
```

- [ ] **Step 9: Verify it compiles**

Run: `pnpm tsc --noEmit`
Expected: no errors. No file should import from `@/lib/notify` anymore.

- [ ] **Step 10: Commit**

```bash
git add lib/email.ts app/inbox/actions.ts app/deals/\[id\]/actions.ts app/deals/\[id\]/message-actions.ts app/campaigns/\[id\]/actions.ts app/c/\[handle\]/actions.ts app/discover/actions.ts app/book/\[offeringId\]/actions.ts
git commit -m "refactor: replace notify() with emailUser(), remove in-app notification writes"
```

---

### Task 7: Delete all notification-only code

**Files:**
- Delete: `lib/notify.ts`
- Delete: `app/notifications/page.tsx`
- Delete: `app/notifications/actions.ts`
- Delete: `components/notifications/notification-list.tsx`
- Delete: `components/ui/filled-bell-icon.tsx`
- Delete: `app/api/cron/brand-agent/route.ts`
- Modify: `components/ui/icons.tsx` — remove `BellIcon` export
- Modify: `lib/analytics.ts` — remove `notification_clicked` event
- Modify: `vercel.json` — remove cron entry (file becomes `{}`)

**Interfaces:**
- Consumes: nothing (pure deletion)
- Produces: nothing

- [ ] **Step 1: Delete notification-only files**

```bash
rm lib/notify.ts
rm app/notifications/page.tsx
rm app/notifications/actions.ts
rm -r components/notifications
rm components/ui/filled-bell-icon.tsx
rm app/api/cron/brand-agent/route.ts
```

If `components/notifications/` directory has no other files, remove the whole directory. If `app/notifications/` directory is now empty, remove it too.

- [ ] **Step 2: Remove `BellIcon` export from `components/ui/icons.tsx`**

Delete line 3: `export { default as BellIcon } from "./filled-bell-icon";`

- [ ] **Step 3: Remove `notification_clicked` from `lib/analytics.ts`**

Delete the line `| "notification_clicked"` from the `AnalyticsEvent` type union (line 33).

- [ ] **Step 4: Clear `vercel.json`**

Replace the contents with an empty object since the only cron entry was for the brand-agent:

```json
{}
```

- [ ] **Step 5: Verify no stale imports remain**

Run: `pnpm tsc --noEmit`

Grep for any remaining references:

```bash
grep -r "notify\|notifications\|notification_clicked\|BellIcon\|filled-bell\|brand-agent" --include="*.ts" --include="*.tsx" lib/ app/ components/
```

Expected: no matches (docs files are fine to ignore). Fix any remaining references.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: delete notification system — table, UI, cron, all references"
```

---

### Task 8: Verify full build and manual test

**Files:** None (verification only)

- [ ] **Step 1: Run full build**

```bash
pnpm build
```

Expected: clean build with no errors. If there are type errors from Supabase generated types not including `feature_cursors`, regenerate them:

```bash
pnpm supabase gen types typescript --local > lib/supabase/database.types.ts
```

Then rebuild.

- [ ] **Step 2: Reset local database and verify seed**

```bash
pnpm supabase db reset
```

Expected: clean reset. No errors about missing `notifications` table.

- [ ] **Step 3: Manual smoke test**

Start the dev server (`pnpm dev`) and verify:

1. **Nav has no Notifications/Alerts tab** — desktop rail should show Inbox, Deals, Campaigns with no `/notifications` entry. Mobile bottom bar should have 4 tabs (creator: Studio, Inbox, Deals, Campaigns; brand: Home, Discover, Inbox, Deals).
2. **Unread dots appear** — as a brand, invite a creator. Switch to the creator account. The Inbox tab should show an amber dot. Navigate to `/inbox` — the dot should clear on next page load.
3. **Email still sends** — check server logs for `emailUser` calls (or check the Resend dashboard if configured).
4. **Navigating to `/notifications` returns 404** — the route is gone.
5. **No console errors** — check browser console and server terminal.

- [ ] **Step 4: Final commit (if any fixes needed)**

If the smoke test revealed issues, fix and commit them here.
