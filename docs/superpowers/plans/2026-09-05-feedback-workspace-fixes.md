# Feedback + Workspace Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 4 Sep 2026 review blockers (routing, auth, campaigns, deals, inbox) and put every authenticated page on the Workspace shell defined in `DESIGN.md`.

**Architecture:** Logic moves into small pure modules with Vitest coverage first. The authenticated chrome becomes one `AppShell` (left rail + inset work panel + optional right pane). Domain fixes (offering gate, revision note, waitlist, password reset) are migrations + server actions on top of that shell. Public-register pages (`/`, `/c/[handle]`, `/login`, `/signup`) stay expressive and are not restyled as the app.

**Tech Stack:** Next.js App Router 16, React 19, Supabase (Postgres + Auth + RLS), Vitest, Tailwind v4, Satoshi.

## Global Constraints

- **Design system:** `DESIGN.md` App register for every authenticated surface. Public register for `/`, `/c/[handle]`, `/login`, `/signup`, `/forgot`, `/reset`.
- **App tokens (verbatim):** `--ground #F8F7F3`, `--rail #F5F3EA`, `--card #FFFFFF`, `--row-hover #F8F7F3`, `--ink #2E2D2A`, `--muted #6E6A64`, `--faint #9A958D` (non-text only), `--border #E9E5DE`, `--divider #F1EEE8`, `--primary` fill `#2E2D2A` text `#F8F7F3`, `--ok #2E7D4F`, `--warn #8F6318`, `--error #B3362B`, `--role-creator` bg `#FFF2EB` text `#8A4A22`, `--role-brand` bg `#EAF7F0` text `#1F6B47`, `--amber` fill `#C9962B` on-fill `#2C2412`, `--shadow-float: 0 8px 24px rgb(27 25 23 / 0.12)`.
- **App type:** page title 24px/600, section 18px/600, body 14px/400, meta 13px/400, nav/chip 12–13px/500. Weight ceiling 700 in-app. No `font-black` / weight 900 behind auth.
- **App layout:** `flex h-dvh`; rail `220px` (collapses to `56px`); main `flex-1 overflow-y-auto`. Work surface is a rounded inset `--card` panel (`16px` radius) on `--ground` with a `--border` hairline. No `max-w-*` on the page shell. Forms only: `max-w-[560px]`.
- **App chrome bans:** no `shadow-card` / `shadow-card-hover` in-app; no hover lift; no pill primary buttons or pill text inputs (radius `8px`); pills (`rounded-full`) only for active nav, tab switchers, status chips, avatars.
- **Work queues:** rows/tables, not cards. Every queue row: identity, meta, status chip, right-aligned next action. Filter-token bar + both empty states (first-run with create CTA, no-results with Reset filters).
- **Notifications:** unread counts live on the owning nav item. Do not add a global bell in the rail.
- **No new npm dependencies.**
- **Server Components by default.** Client components only for rail active-state, split pane, composer, wizards, dialogs.
- **Tests:** `npx vitest run <file>`. Do not add Playwright in this plan; UI is verified in the browser after each task that changes a route.
- **Copy:** full sentences, correct punctuation. No placeholder lorem.

## Out of scope (do not implement in this plan)

| Ticket | Why |
|---|---|
| F13 fun-filled in-app UI | Contradicts App register. Personality stays on Public surfaces. |
| F12 landing page | `/` already exists. Public polish is a later pass. |
| F11 creator rating data | Already planned in `docs/superpowers/plans/2026-09-03-data-collection.md`. |
| F19 escrow | Payments infrastructure. Current `payment_mode` stays `off_platform`. |
| F20 $25–$50 plans | Billing. Not required to unblock the live walkthrough. |
| WhatsApp integration | Debated both ways in the meeting. No committed request. |
| F18 group chat | Inbox is already 1:1 brand–creator. Keep it that way; no extra work. |

## Ticket → task map

| IDs | Task |
|---|---|
| B02, B03 | Task 2 |
| F01, F02 | Task 3 |
| DESIGN.md tokens | Task 4 |
| F04, F09, F10, B04 | Task 5 |
| F05, B16 | Task 6 |
| B07, B15, B14 | Task 7 |
| B10, B11, B13, F14 | Task 8 |
| B12, F06, F17 | Task 9 |
| B08, F07, F08 | Task 10 |
| B05, F03 | Task 11 |
| B01, B06, B17 | Task 12 |
| F15, F16 | Task 13 |
| B09 | folded into each UI task’s copy |

## File map

**Create**

- `lib/auth/home.ts` — role → in-app home path
- `lib/inbox/cta.ts` — which primary CTA a conversation shows
- `lib/campaigns/offering-match.ts` — creator has an active offering of campaign type
- `lib/creators/waitlist.ts` — follower threshold → live vs waitlisted
- `lib/filters/tokens.ts` — parse/serialize filter-token search params
- `app/(auth)/forgot/page.tsx`
- `app/(auth)/reset/page.tsx`
- `components/app-shell.tsx`
- `components/app-rail.tsx`
- `components/inbox/inbox-workspace.tsx`
- `components/inbox/message-composer.tsx`
- `components/campaigns/template-picker.tsx`
- `components/filters/filter-token-bar.tsx`
- `supabase/migrations/0023_feedback_fixes.sql`

**Modify (by later task)**

- `lib/auth/require.ts`, `lib/auth/__tests__/require.test.ts`
- `app/(auth)/actions.ts`, `app/(auth)/login/page.tsx`
- `app/globals.css`
- `components/site-nav.tsx`, `components/mobile-nav.tsx`
- All authenticated pages that currently render `<SiteNav />` (dashboard, brand, inbox, deals, campaigns, discover, notifications, book, admin, report, settings)
- `app/brand/page.tsx`, `app/onboarding/layout.tsx`
- `components/onboarding/wizard-shell.tsx`, `components/brand/onboarding-wizard.tsx`
- `app/inbox/page.tsx`, `app/inbox/[id]/page.tsx`, `app/inbox/actions.ts`
- `app/campaigns/page.tsx`, `app/campaigns/[id]/page.tsx`, `app/campaigns/[id]/actions.ts`
- `app/deals/page.tsx`, `app/deals/[id]/page.tsx`, `app/deals/[id]/actions.ts`
- `lib/deals/ui-actions.ts`, `lib/deals/__tests__/ui-actions.test.ts`
- `app/dashboard/page.tsx`

---

### Task 1: In-app home helper and wrong-role redirect

**Files:**
- Create: `lib/auth/home.ts`
- Modify: `lib/auth/require.ts`
- Modify: `lib/auth/__tests__/require.test.ts`
- Test: `lib/auth/__tests__/require.test.ts`

**Interfaces:**
- Consumes: `Role` (`"creator" | "brand" | "admin"`)
- Produces:
  - `homeForRole(role: Role): "/dashboard" | "/brand" | "/admin"`
  - `gateDecision` redirects a signed-in wrong-role user to `homeForRole(actualRole)`, never `/`

This is B02. `gateDecision(..., "brand", "creator")` currently returns `{ redirect: "/" }`, which dumps an authenticated user onto the public landing (“home going outside”).

- [ ] **Step 1: Write the failing tests**

Add to `lib/auth/__tests__/require.test.ts`:

```ts
import { homeForRole } from "@/lib/auth/home";

describe("homeForRole", () => {
  it("keeps each role inside the app", () => {
    expect(homeForRole("creator")).toBe("/dashboard");
    expect(homeForRole("brand")).toBe("/brand");
    expect(homeForRole("admin")).toBe("/admin");
  });
});

it("user without required role -> redirect to that user's in-app home", () => {
  expect(gateDecision({ id: "u1" }, "brand", "creator")).toEqual({ redirect: "/brand" });
  expect(gateDecision({ id: "u1" }, "creator", "brand")).toEqual({ redirect: "/dashboard" });
  expect(gateDecision({ id: "u1" }, "admin", "brand")).toEqual({ redirect: "/admin" });
});
```

Delete or replace the existing test named `user without required role -> redirect home` that expects `"/"`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/auth/__tests__/require.test.ts`

Expected: FAIL — `homeForRole` is not exported and wrong-role still redirects to `/`.

- [ ] **Step 3: Implement**

`lib/auth/home.ts`:

```ts
export type Role = "creator" | "brand" | "admin";

export function homeForRole(role: Role): "/dashboard" | "/brand" | "/admin" {
  if (role === "creator") return "/dashboard";
  if (role === "admin") return "/admin";
  return "/brand";
}
```

In `lib/auth/require.ts`, import `homeForRole` and `Role` from `./home` (re-export `Role` if other files import it from `require.ts`). Change `gateDecision`:

```ts
export function gateDecision(
  user: { id: string } | null,
  actualRole: Role | null,
  requiredRole: Role | null
): { ok: true } | { redirect: string } {
  if (!user) return { redirect: "/login" };
  if (requiredRole && actualRole !== requiredRole) {
    return { redirect: actualRole ? homeForRole(actualRole) : "/" };
  }
  return { ok: true };
}
```

Keep unauthenticated → `/login`. Keep missing profile role → `/` only when `actualRole` is null (should not happen after signup).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/auth/__tests__/require.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/auth/home.ts lib/auth/require.ts lib/auth/__tests__/require.test.ts
git commit -m "$(cat <<'EOF'
fix: keep wrong-role redirects inside the app

Authenticated users hitting the other side's routes were sent to the public landing.
EOF
)"
```

---

### Task 2: Home stays Home (no onboarding hijack)

**Files:**
- Modify: `app/brand/page.tsx` (remove the hard redirect at the `if (!profileRes.data) redirect("/brand/onboarding")` line)
- Modify: `app/(auth)/actions.ts` (login still *can* send a brand with no profile to `/brand/onboarding` on first login only)
- Test: `lib/auth/__tests__/require.test.ts` (no new file; behavior is page-level — cover the rule in a helper)

**Interfaces:**
- Consumes: `homeForRole`
- Produces: `shouldForceBrandOnboarding(hasProfile: boolean, source: "login" | "nav"): boolean`

B03: `/brand` currently redirects to `/brand/onboarding` whenever `brand_profiles` is missing, so Brand home is unreachable. DESIGN.md: Home is a work surface; setup is a floating checklist, not a route hijack.

- [ ] **Step 1: Write the failing test**

Add `lib/onboarding/brand-gate.ts` in Step 3. First add `lib/onboarding/__tests__/brand-gate.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { shouldForceBrandOnboarding } from "@/lib/onboarding/brand-gate";

describe("shouldForceBrandOnboarding", () => {
  it("first login with no profile still opens the wizard", () => {
    expect(shouldForceBrandOnboarding(false, "login")).toBe(true);
  });
  it("nav to Home never hijacks, even with no profile", () => {
    expect(shouldForceBrandOnboarding(false, "nav")).toBe(false);
    expect(shouldForceBrandOnboarding(true, "nav")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/onboarding/__tests__/brand-gate.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement helper and page**

`lib/onboarding/brand-gate.ts`:

```ts
export function shouldForceBrandOnboarding(
  hasProfile: boolean,
  source: "login" | "nav"
): boolean {
  return source === "login" && !hasProfile;
}
```

`app/(auth)/actions.ts` — keep the existing `brandHome = "/brand/onboarding"` when `!bp` (login source).

`app/brand/page.tsx` — delete `if (!profileRes.data) redirect("/brand/onboarding");`. When `!profileRes.data`, render the existing page title plus a first-run empty state:

- Headline: `Finish setting up your brand`
- One line: `Add your company name and the formats you book. Then you can post a campaign.`
- Primary CTA linking to `/brand/onboarding`: `Continue setup`
- Do not use `shadow-card`. Use a `--card` tile with `--border` hairline, radius `12px`, padding `16px`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/onboarding/__tests__/brand-gate.test.ts lib/auth/__tests__/require.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/onboarding/brand-gate.ts lib/onboarding/__tests__/brand-gate.test.ts app/brand/page.tsx
git commit -m "$(cat <<'EOF'
fix: stop sending Brand home to onboarding

Home is a work surface. First-time login can still open the wizard; the Home nav item cannot.
EOF
)"
```

---

### Task 3: Forgot password and password reset

**Files:**
- Modify: `app/(auth)/actions.ts`
- Modify: `app/(auth)/login/page.tsx`
- Create: `app/(auth)/forgot/page.tsx`
- Create: `app/(auth)/reset/page.tsx`
- Test: `lib/auth/__tests__/safe-next.test.ts` (reuse `safeNext` for the reset redirect)

**Interfaces:**
- Consumes: `createServerSupabase()`, `safeNext`
- Produces:
  - `requestPasswordReset(formData: FormData): Promise<void>` — calls `supabase.auth.resetPasswordForEmail`
  - `updatePassword(formData: FormData): Promise<void>` — calls `supabase.auth.updateUser({ password })`

F01 (confirmed in the meeting: passwords are shared in the group). F02: keep Log in visible on the login card (Public register — `font-black` on the wordmark is allowed here).

Public-register styling on these pages: keep the existing split layout from `app/(auth)/login/page.tsx`. Buttons may stay as they are on Public surfaces.

- [ ] **Step 1: Add server actions**

In `app/(auth)/actions.ts`:

```ts
export async function requestPasswordReset(formData: FormData) {
  const supabase = await createServerSupabase();
  const email = String(formData.get("email") ?? "").trim();
  if (!email) redirect("/forgot?error=" + encodeURIComponent("Enter the email on your account"));
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/reset`,
  });
  if (error) redirect("/forgot?error=" + encodeURIComponent(error.message));
  redirect("/forgot?sent=1");
}

export async function updatePassword(formData: FormData) {
  const supabase = await createServerSupabase();
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) {
    redirect("/reset?error=" + encodeURIComponent("Use at least 8 characters"));
  }
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect("/reset?error=" + encodeURIComponent(error.message));
  redirect("/login");
}
```

Always show the same success copy after `/forgot?sent=1` whether or not the email exists (do not leak accounts).

- [ ] **Step 2: Add pages**

`app/(auth)/forgot/page.tsx` — Public split layout, heading `Reset your password`, email field, submit `Send reset link`, link back to `/login`. On `?sent=1` show: `If that email is on an account, we sent a reset link.`

`app/(auth)/reset/page.tsx` — heading `Choose a new password`, password field (min 8), submit `Update password`.

On `app/(auth)/login/page.tsx`, under the password field, add:

```tsx
<p className="text-sm">
  <Link href="/forgot" className="font-medium text-primary hover:underline">
    Forgot password?
  </Link>
</p>
```

- [ ] **Step 3: Document the Supabase redirect allow-list**

In the commit body / PR notes: add `https://<prod-host>/reset` and `http://localhost:3000/reset` to the project's Auth redirect URLs. Do not invent a dashboard click; leave this as an operator step in the commit message.

- [ ] **Step 4: Commit**

```bash
git add app/\(auth\)/actions.ts app/\(auth\)/login/page.tsx app/\(auth\)/forgot/page.tsx app/\(auth\)/reset/page.tsx
git commit -m "$(cat <<'EOF'
feat: add forgot-password and reset flow

Reviewers were sharing passwords in the group because reset did not exist.
EOF
)"
```

---

### Task 4: App-register tokens in CSS

**Files:**
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `DESIGN.md` Color / Elevation / Radii
- Produces: CSS variables `--ground`, `--rail`, `--ink`, `--row-hover`, `--divider`, `--faint`, `--shadow-float`, `--radius-control: 8px`, `--radius-tile: 12px`, `--radius-panel: 16px`. Keep `--shadow-card` defined so Public pages do not break.

Do not restyle Public pages in this task. Only add tokens.

- [ ] **Step 1: Update `:root` in `app/globals.css`**

Replace the Gallery Frame comment and values with Workspace tokens. Keep a `--shadow-card` definition for Public use. Add:

```css
:root {
  --font-sans: "Satoshi", ui-sans-serif, system-ui, sans-serif;
  --ground: #f8f7f3;
  --rail: #f5f3ea;
  --background: var(--ground);
  --foreground: #2e2d2a;
  --ink: #2e2d2a;
  --card: #ffffff;
  --card-foreground: #2e2d2a;
  --row-hover: #f8f7f3;
  --muted: #f1eee8;
  --muted-foreground: #6e6a64;
  --faint: #9a958d;
  --border: #e9e5de;
  --divider: #f1eee8;
  --primary: #2e2d2a;
  --primary-foreground: #f8f7f3;
  --ok: #2e7d4f;
  --warn: #8f6318;
  --destructive: #b3362b;
  --amber: #c9962b;
  --amber-foreground: #2c2412;
  --role-creator: #fff2eb;
  --role-creator-foreground: #8a4a22;
  --role-brand: #eaf7f0;
  --role-brand-foreground: #1f6b47;
  --radius: 0.5rem; /* 8px controls */
  --radius-tile: 0.75rem;
  --radius-panel: 1rem;
  --shadow-float: 0 8px 24px rgb(27 25 23 / 0.12);
  --shadow-card: 0 1px 2px rgb(27 25 23 / 0.05), 0 6px 20px rgb(27 25 23 / 0.06);
  --shadow-card-hover: 0 2px 4px rgb(27 25 23 / 0.06), 0 10px 28px rgb(27 25 23 / 0.10);
}
```

Map `--color-background` etc. in `@theme inline` onto these. Add `--color-ground`, `--color-rail`, `--color-ink`, `--color-row-hover`, `--color-divider`, `--color-faint`.

Change `body` to `bg-background text-foreground`. Change heading `letter-spacing` to `-0.01em` (App). Do not add a global `font-black` rule.

- [ ] **Step 2: Commit**

```bash
git add app/globals.css
git commit -m "$(cat <<'EOF'
feat: add Workspace color tokens from DESIGN.md

Sampled rail/ground/ink values so the shell can sit on the new register without guessing.
EOF
)"
```

---

### Task 5: Persistent left rail and mobile Deals

**Files:**
- Create: `components/app-rail.tsx`
- Create: `components/app-shell.tsx`
- Modify: `components/mobile-nav.tsx`
- Modify: `components/site-nav.tsx` (thin wrapper that renders `AppShell` children only if we keep a compat export — prefer replacing call sites)
- Modify every authenticated page that currently does `<SiteNav />` + `<main className="mx-auto w-full max-w-*">`: wrap with `AppShell` and drop `max-w-*` on the shell (forms keep `max-w-[560px]` inside).

**Interfaces:**
- Consumes: `role`, `userId`, `unreadInbox: number`, `unreadNotifications: number`, `displayName`, `email`, `workspaceName`, `workspaceRole: "creator" | "brand" | "admin"`
- Produces:
  - `AppShell({ role, userId, unreadInbox, unreadNotifications, identity, children, pane?: ReactNode })`
  - Rail active state: `pathname === href || pathname.startsWith(href + "/")`
  - Deals item is always present for creator and brand (B04, F09)

Rail contents (DESIGN.md, top to bottom):

Creator: identity → Inbox, Deals, Campaigns (core) → Dashboard/Storefront (business) → Notifications, Settings (utility, pinned bottom).

Brand: identity → Inbox, Deals, Campaigns (core) → Discover, Brand home (business) → Notifications, Settings (utility).

Unread inbox count on Inbox. Unread notifications count on Notifications. No global bell.

Active item: `--card` pill, `--border` hairline, `rounded-full`. Inactive: 13px `--ink`/`--muted`. Support `?` link at the bottom of the rail pointing at `/notifications` is wrong — use a `mailto:` or existing help only if one exists; otherwise omit rather than invent a help center.

Mobile: keep `MobileNav`. Creator and brand both include Deals. Add `pb-20 md:pb-0` on the inset panel so rows are not hidden behind the bar (this is why Deals “are not seen” on phones). Highlight the active tab with `--ink` and `aria-current="page"` (F09). Match `/deals/[id]` as Deals via `startsWith`.

- [ ] **Step 1: Build `AppRail` as a client component**

`components/app-rail.tsx` — `"use client"`, `usePathname()`. Identity block at top: avatar initial, workspace name, role chip (`--role-creator` / `--role-brand`), chevron details with email + Log out form (`logout` server action). Nav items `icon + label` at 13px.

Width: `w-[220px] shrink-0 bg-[var(--rail)]`. Height: `h-dvh`.

- [ ] **Step 2: Build `AppShell`**

```tsx
export function AppShell({
  children,
  pane,
  ...railProps
}: {
  children: React.ReactNode;
  pane?: React.ReactNode;
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
      <MobileNav role={railProps.role} unread={railProps.unreadNotifications} inboxUnread={railProps.unreadInbox} />
    </div>
  );
}
```

Page titles inside children: `text-2xl font-semibold tracking-tight` (24px/600). Not `text-3xl font-extrabold`.

- [ ] **Step 3: Migrate pages off `SiteNav`**

Replace the `<SiteNav /><main className="mx-auto max-w-…">` pair on: `app/dashboard/page.tsx`, `app/brand/page.tsx`, `app/brand/settings/page.tsx`, `app/inbox/page.tsx`, `app/inbox/[id]/page.tsx` (temporary; Task 6 will split), `app/deals/page.tsx`, `app/deals/[id]/page.tsx`, `app/campaigns/page.tsx`, `app/campaigns/[id]/page.tsx`, `app/discover/page.tsx`, `app/notifications/page.tsx`, `app/book/[offeringId]/page.tsx`, `app/admin/page.tsx`, `app/admin/deals/[id]/page.tsx`, `app/report/page.tsx`.

Query unread inbox the same way `SiteNav` queries notifications, plus:

```ts
const { count: unreadInbox } = await supabase
  .from("conversations")
  .select("id", { count: "exact", head: true })
  .or(`brand_id.eq.${userId},creator_id.eq.${userId}`)
  .eq("status", "invited");
```

If counting invited-as-creator is more accurate, filter `creator_id = userId` and `status = invited` for the badge. Do not invent a messages-unread column in this task.

- [ ] **Step 4: Fix mobile Deals**

In `components/mobile-nav.tsx`:

- Creator tabs: Studio, Inbox, Deals, Campaigns, Alerts. Drop the central “New” sparkle (it ate a slot and hid Deals’ presence). If five is the cap, use Studio, Inbox, Deals, Campaigns, Alerts.
- Brand tabs: Home, Discover, Inbox, Deals, Alerts.
- `aria-current` and a `--card`/`--ink` active treatment. No `shadow-md` on the central button (there is no central button).

- [ ] **Step 5: Browser check**

Log in as creator and as brand at a desktop width and a 390px width. Confirm: left rail on desktop, Deals visible and tappable on mobile, active pill on the current section, logo/Home does not open the public landing.

- [ ] **Step 6: Commit**

```bash
git add components/app-shell.tsx components/app-rail.tsx components/mobile-nav.tsx components/site-nav.tsx app
git commit -m "$(cat <<'EOF'
feat: replace top tabs with a Workspace left rail

Authenticated pages use a persistent rail and inset panel so Deals, Inbox, and Campaigns keep a fixed home.
EOF
)"
```

---

### Task 6: Inbox as an in-place split pane

**Files:**
- Create: `components/inbox/inbox-workspace.tsx`
- Modify: `app/inbox/page.tsx`
- Modify: `app/inbox/[id]/page.tsx` — keep as a full-page fallback for mobile and shared links; desktop `/inbox?c=<id>` opens the pane
- Test: none for layout; logic for selected id parsing in `lib/inbox/cta.ts` is Task 7

**Interfaces:**
- Consumes: conversation list data already loaded on `app/inbox/page.tsx`
- Produces: `InboxWorkspace({ conversations, selectedId, children })` where `children` is the thread

F05 (chat + meeting): Open conversation must not replace the whole view. Half-and-half is enough. No popup. No separate page on desktop. Meeting: “I still have the context of where I am.”

- [ ] **Step 1: URL as source of truth**

`app/inbox/page.tsx` reads `searchParams.c`. If present and owned, render `AppShell` with `pane={<Thread />}` on `lg+`. The list stays in the main column. Clicking a row is `<Link href={`/inbox?c=${id}`}>` , not `/inbox/${id}`, on desktop. Mobile (`md` and down) still goes to `/inbox/[id]` so the thread is usable at 390px.

- [ ] **Step 2: Extract thread UI**

Move the thread body from `app/inbox/[id]/page.tsx` into a server component `components/inbox/conversation-thread.tsx` that both the pane and `/inbox/[id]` render. Do not restyle as cards with `shadow-card`. Message rows are list rows on `--secondary` / `--primary` fills, radius `8px`.

Thread list on the left: table-like rows (identity, preview, status chip, relative time). Hover fill `--row-hover`. Next action on the row (Accept invite, Open offer) per Task 7.

- [ ] **Step 3: Browser check**

From Discover or a deal, open a conversation. Desktop: list remains, thread opens on the right. Back/forward keeps `?c=`. Mobile: full-page thread with ← Inbox. No modal.

- [ ] **Step 4: Commit**

```bash
git add app/inbox components/inbox
git commit -m "$(cat <<'EOF'
feat: open inbox threads in a split pane

Desktop keeps the conversation list in view so brands do not lose campaign context.
EOF
)"
```

---

### Task 7: Inbox CTA, Enter key, and composer memory

**Files:**
- Create: `lib/inbox/cta.ts`
- Create: `lib/inbox/__tests__/cta.test.ts`
- Create: `components/inbox/message-composer.tsx`
- Modify: `app/inbox/actions.ts` (`sendThreadMessage` deletes the `agent_drafts` row after send)
- Modify: `components/inbox/conversation-thread.tsx` (from Task 6)

**Interfaces:**
- Produces:

```ts
export type InboxCta =
  | { kind: "accept_invite" }
  | { kind: "wait_invite" }
  | { kind: "accept_offer"; offerId: string }
  | { kind: "send_offer" }
  | { kind: "chat" }
  | { kind: "none" };

export function inboxCta(input: {
  role: "brand" | "creator";
  convStatus: "invited" | "accepted" | "declined";
  hasPendingOffer: boolean;
  pendingOfferId?: string;
}): InboxCta;
```

B14: never show Send offer to the party who should Accept. B07: one Enter behavior. B15: sending a message clears the AI draft so the next compose is not the previous take-it-or-leave-it.

- [ ] **Step 1: Failing tests**

```ts
import { describe, it, expect } from "vitest";
import { inboxCta } from "@/lib/inbox/cta";

describe("inboxCta", () => {
  it("creator on an invite sees Accept, not Send offer", () => {
    expect(inboxCta({ role: "creator", convStatus: "invited", hasPendingOffer: false }).kind)
      .toBe("accept_invite");
  });
  it("brand on an invite waits", () => {
    expect(inboxCta({ role: "brand", convStatus: "invited", hasPendingOffer: false }).kind)
      .toBe("wait_invite");
  });
  it("creator with a pending offer sees Accept offer", () => {
    expect(
      inboxCta({ role: "creator", convStatus: "accepted", hasPendingOffer: true, pendingOfferId: "o1" })
    ).toEqual({ kind: "accept_offer", offerId: "o1" });
  });
  it("brand with no pending offer may send one", () => {
    expect(inboxCta({ role: "brand", convStatus: "accepted", hasPendingOffer: false }).kind)
      .toBe("send_offer");
  });
  it("brand with a pending offer does not see Send offer", () => {
    expect(inboxCta({ role: "brand", convStatus: "accepted", hasPendingOffer: true }).kind)
      .toBe("chat");
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run lib/inbox/__tests__/cta.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `inboxCta` and wire the thread header to it**

Render exactly one primary button from `inboxCta`. Secondary actions stay in the thread body.

- [ ] **Step 4: Message composer**

`components/inbox/message-composer.tsx` — client component.

- `Enter` submits. `Shift+Enter` inserts a newline. No other Enter binding.
- The AI “Draft a reply” control is a `<button type="button">` in a separate form so Enter in the textarea cannot submit it.
- After `sendThreadMessage` succeeds, delete the draft:

```ts
await supabase.from("agent_drafts").delete().eq("conversation_id", conversationId);
```

Pass `defaultValue={draft?.body ?? ""}` only when a draft exists for *this* `conversation_id` (already queried that way; the bug is leftover rows after send).

- [ ] **Step 5: Run tests**

Run: `npx vitest run lib/inbox/__tests__/cta.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/inbox app/inbox components/inbox
git commit -m "$(cat <<'EOF'
fix: inbox CTA, Enter-to-send, and draft memory

The primary button now matches the actor, Enter has one meaning, and AI drafts die after send.
EOF
)"
```

---

### Task 8: Campaigns list, Orders vs Deals, template picker

**Files:**
- Create: `components/campaigns/template-picker.tsx`
- Modify: `app/campaigns/page.tsx`
- Modify: `app/campaigns/actions.ts` (`createCampaign` already redirects to `/campaigns/[id]` — keep that)
- Modify: `app/deals/page.tsx` (page title and empty copy so bookings are not hunted under “Orders”)
- Modify: `app/campaigns/[id]/page.tsx` (replace `Use as template →` query-string clone with the picker)

**Interfaces:**
- Consumes: existing `createCampaign`, clone fetch
- Produces: dialog that POSTs `createCampaign` immediately (Canva pattern). No `?clone=` leftover after submit.

B10: creator open-campaigns list is the source of truth; after create, both roles land on `/campaigns/[id]` which must be readable (open campaigns already are). If the other user was looking at Deals, they will still see nothing — B11 is copy: there is no Orders route. Rename nothing in the schema. Change copy.

B13: `Use as template` currently sets `?clone=` and prefills a form below the list. Refresh looks like a submitted-but-empty state.

- [ ] **Step 1: Copy on Deals**

`app/deals/page.tsx` title stays `Deals` (F09). Subtitle: `Bookings and campaigns you accepted live here. Open campaigns are under Campaigns.` First-run empty state CTA: brands `Start a campaign` → `/campaigns`; creators `See open campaigns` → `/campaigns`. No dashed dead-end.

- [ ] **Step 2: Template picker**

`components/campaigns/template-picker.tsx` — client dialog (`shadow-float` only, it floats). Lists the brand’s existing campaigns as tiles (radius `12px`, hairline). Choosing one POSTs hidden fields (title prefix `Copy of …`, description, offering_type, budgets) to `createCampaign`. Cancel closes. Do not keep `clone` in the URL after success (`createCampaign` already redirects to the new id).

Remove the always-visible create form from the top of the list. Primary page action: `New campaign` opens either a blank form in the same dialog or `Start from a template`. List of campaigns is the first thing on the page (rows, not cards).

- [ ] **Step 3: Creator empty vs brand empty**

Creator with zero open campaigns: no-results is wrong (data does not exist). Use first-run copy: `No open campaigns right now. Brands post briefs here.` No illustration required if none exists; do not ship a dashed icon box with no action. Brand first-run: CTA `New campaign`.

- [ ] **Step 4: Browser check**

Create from a template. Land on `/campaigns/[id]`. Refresh. Campaign still there. Log in as a creator and open `/campaigns` (not Deals). Confirm the new open campaign is listed.

- [ ] **Step 5: Commit**

```bash
git add app/campaigns app/deals components/campaigns
git commit -m "$(cat <<'EOF'
fix: campaign templates create immediately and Deals copy stops implying Orders

Clone-as-query-string left a prefilled form that looked unsubmitted after refresh.
EOF
)"
```

---

### Task 9: Offering match gate and recovery

**Files:**
- Create: `lib/campaigns/offering-match.ts`
- Create: `lib/campaigns/__tests__/offering-match.test.ts`
- Modify: `app/campaigns/[id]/actions.ts` (`applyToCampaign`)
- Modify: `app/campaigns/[id]/page.tsx` (hide Apply; show recovery)
- Modify: `supabase/migrations/0023_feedback_fixes.sql` (start this file; later tasks append)

**Interfaces:**

```ts
export function creatorCanApply(args: {
  campaignType: string;
  activeOfferingTypes: string[];
}): boolean {
  return args.activeOfferingTypes.includes(args.campaignType);
}
```

B12 / F06 / F17: `accept_campaign_application` already throws `This creator has no active % offering`. Apply currently inserts anyway, so brands accept into a dead end.

- [ ] **Step 1: Failing tests**

```ts
import { describe, it, expect } from "vitest";
import { creatorCanApply } from "@/lib/campaigns/offering-match";

describe("creatorCanApply", () => {
  it("allows a matching active offering", () => {
    expect(creatorCanApply({
      campaignType: "short_form_post",
      activeOfferingTypes: ["short_form_post", "ugc_video"],
    })).toBe(true);
  });
  it("blocks a missing format", () => {
    expect(creatorCanApply({
      campaignType: "short_form_post",
      activeOfferingTypes: ["dedicated_video"],
    })).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run lib/campaigns/__tests__/offering-match.test.ts`

Expected: FAIL

- [ ] **Step 3: Implement helper, action, UI, and DB check**

`applyToCampaign`: load campaign `offering_type` and the creator’s active offerings. If `!creatorCanApply`, redirect with:

`This campaign needs a Short-form post offering. Add one to your storefront, or ask the brand to book another format.`

Page: if the viewer is the creator and they cannot apply, do not render the apply form. Render two actions: `Add a Short-form post offering` → `/dashboard?tab=offerings`, and `View your storefront` → `/c/[handle]` if handle exists.

Append to `0023_feedback_fixes.sql`:

```sql
create or replace function public.validate_campaign_application_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_campaign public.campaigns;
begin
  select * into v_campaign from public.campaigns c where c.id = new.campaign_id;
  if v_campaign.status <> 'open' then
    raise exception 'Campaign is not open';
  end if;
  if v_campaign.apply_by is not null and v_campaign.apply_by < current_date then
    raise exception 'Applications have closed';
  end if;
  if not exists (
    select 1 from public.offerings o
    where o.creator_id = new.creator_id
      and o.type = v_campaign.offering_type
      and o.active
  ) then
    raise exception 'This campaign needs an active % offering — add one, or book another format',
      v_campaign.offering_type;
  end if;
  new.status := 'pending';
  new.deal_id := null;
  return new;
end;
$$;
```

Preserve any other existing checks from `0014_campaigns.sql` / `0022_campaign_decline_reason.sql` (read those functions before replacing; merge, do not drop decline_reason behavior).

- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/campaigns/__tests__/offering-match.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/campaigns app/campaigns supabase/migrations/0023_feedback_fixes.sql
git commit -m "$(cat <<'EOF'
fix: block campaign apply without a matching offering

Accepting those applications failed in SQL and left brands in a dead end.
EOF
)"
```

---

### Task 10: Request-changes note, accept preview, two-step review

**Files:**
- Modify: `lib/deals/ui-actions.ts`
- Modify: `lib/deals/__tests__/ui-actions.test.ts`
- Modify: `app/deals/[id]/actions.ts`
- Modify: `app/deals/[id]/page.tsx`
- Modify: `supabase/migrations/0023_feedback_fixes.sql`

**Interfaces:**
- Extend `UiAction` with `needsNote?: boolean` and `needsPreview?: boolean`
- `request_revision` → `needsNote: true`
- `approve` stays, but the page shows a two-step: (1) preview the live/preview URL, (2) confirm Approve

B08: Request changes has no text field. F07: accepting preview. F08: two-step review.

- [ ] **Step 1: Failing tests**

Add to `lib/deals/__tests__/ui-actions.test.ts`:

```ts
it("request changes requires a note", () => {
  const a = actionsFor("submitted", "brand", "off_platform")
    .find((x) => x.action === "request_revision");
  expect(a?.needsNote).toBe(true);
});

it("approve is the brand action on published, with preview", () => {
  const a = actionsFor("published", "brand", "off_platform")
    .find((x) => x.action === "approve");
  expect(a?.needsPreview).toBe(true);
});
```

Add `needsNote` / `needsPreview` to the `UiAction` type and the `request_revision` / `approve` candidates. Default both to false.

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run lib/deals/__tests__/ui-actions.test.ts`

Expected: FAIL on `needsNote` / `needsPreview` undefined.

- [ ] **Step 3: Payload + migration**

In `0023_feedback_fixes.sql`:

```sql
alter table public.deals
  add column if not exists last_revision_note text
  check (last_revision_note is null or length(last_revision_note) between 1 and 2000);
```

In `performDealAction`, if `action === "request_revision"`:

```ts
const note = parseText(String(formData.get("note") ?? ""), 2000);
if (!note) {
  redirect(`/deals/${dealId}?error=` + encodeURIComponent("Say what to change (max 2000 characters)"));
}
payload.revision_note = note;
```

After a successful `request_revision` transition, `update deals set last_revision_note = note where id = dealId`. Show that note on the deal page for the creator.

For approve: the deal page already links `preview_url` / `live_url`. Wrap Approve in a `<details>` or two-button sequence: `Review preview` (opens the URL) then `Approve & complete` (submit). Both buttons radius `8px`. Do not skip the URL when `needsPreview` is true — if both URLs are missing, show an error, do not complete.

- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/deals/__tests__/ui-actions.test.ts lib/deals/__tests__/machine.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/deals app/deals/[id] supabase/migrations/0023_feedback_fixes.sql
git commit -m "$(cat <<'EOF'
feat: require a note on Request changes and a two-step preview approve

Brands had no place to write revision feedback, and Approve had no preview step.
EOF
)"
```

---

### Task 11: Onboarding back + required-field marks

**Files:**
- Modify: `components/onboarding/wizard-shell.tsx`
- Modify: `lib/onboarding/steps.ts` (previous-step helper)
- Modify: `lib/onboarding/__tests__/steps.test.ts`
- Modify: creator and brand forms: `app/onboarding/profile/page.tsx`, offerings, socials, `components/brand/onboarding-wizard.tsx`, `components/brand/brand-profile-form.tsx`

**Interfaces:**

```ts
export function previousStep(step: WizardStep): WizardStep | null;
```

B05: creator `WizardShell` has no Back; step pills are not links. Brand wizard already has Back for step > 1 — keep it, make sure it is `type="button"`. F03: mark required fields with a visible `*` and `aria-required`. Guidance is short helper text under the field, not a video-game overlay (that would fight App restraint). First-run empty states already specified in DESIGN.md.

- [ ] **Step 1: Failing tests**

```ts
it("previousStep walks backward and stops at profile", () => {
  expect(previousStep("profile")).toBeNull();
  expect(previousStep("socials")).toBe("profile");
  expect(previousStep("publish")).toBe("highlights");
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run lib/onboarding/__tests__/steps.test.ts`

Expected: FAIL

- [ ] **Step 3: Implement Back**

`previousStep`:

```ts
export function previousStep(step: WizardStep): WizardStep | null {
  const i = stepIndex(step);
  return i <= 0 ? null : WIZARD_STEPS[i - 1];
}
```

In `WizardShell`, above the form, if `previousStep(step)` is set, render:

```tsx
<Link href={`/onboarding/${previousStep(step)}`} className="text-sm text-muted-foreground hover:text-foreground">
  ← Back
</Link>
```

Completed step pills become `<Link href={/onboarding/${s}}>`. Future steps stay inert.

On every required input in onboarding forms, label:

```tsx
<Label htmlFor="handle">Handle <span aria-hidden className="text-[var(--error)]">*</span></Label>
```

Helper line under handle: `This is your public URL: clipline.app/c/your-handle.`

- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/onboarding/__tests__/steps.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/onboarding components/onboarding app/onboarding components/brand
git commit -m "$(cat <<'EOF'
feat: let onboarding go back a step and mark required fields

Creators could not return to a previous wizard step, and required inputs were unmarked.
EOF
)"
```

---

### Task 12: Dashboard filter-token bar and stats

**Files:**
- Create: `lib/filters/tokens.ts`
- Create: `lib/filters/__tests__/tokens.test.ts`
- Create: `components/filters/filter-token-bar.tsx`
- Modify: `app/dashboard/page.tsx`
- Modify: `app/brand/page.tsx`
- Modify: `app/deals/page.tsx`

**Interfaces:**

```ts
export type FilterToken = { key: string; label: string; value: string };

export function parseFilterTokens(sp: URLSearchParams, allowed: string[]): FilterToken[];
export function toSearchParams(tokens: FilterToken[]): URLSearchParams;
```

B01: dashboard filter is messed up. DESIGN.md: every list surface gets removable chips (`Label: value ×`) plus `+`, backed by URL search params. B06 / B17: metric strip is derived from the *active filter set*, compact tiles, not hero KPIs. Missing dash: show `—` with muted `No rating yet`, never a blank or `NaN`.

- [ ] **Step 1: Failing tests**

```ts
import { describe, it, expect } from "vitest";
import { parseFilterTokens, toSearchParams } from "@/lib/filters/tokens";

describe("filter tokens", () => {
  it("reads known keys and ignores junk", () => {
    const sp = new URLSearchParams("status=submitted&foo=bar");
    expect(parseFilterTokens(sp, ["status", "role"])).toEqual([
      { key: "status", label: "Status", value: "submitted" },
    ]);
  });
  it("round-trips", () => {
    const tokens = [{ key: "status", label: "Status", value: "accepted" }];
    expect(toSearchParams(tokens).get("status")).toBe("accepted");
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run lib/filters/__tests__/tokens.test.ts`

Expected: FAIL

- [ ] **Step 3: Implement bar + metrics**

Deals and both homes: filter keys `status`, `needs_me=1`. Chips use `rounded-full` (allowed). Metrics: three tiles inside the work surface, `20px/600` tabular values, `11px` uppercase labels. Values recomputed from the filtered row set. Rating: if no reviews, value `—` and label `No rating yet` (`--muted`, not `--faint`).

Remove `shadow-card` shimmer stat cards on `/dashboard` and `/brand`. Remove `max-w-6xl`.

Empty: if tokens active and zero rows → `No results match your filters` + `Reset filters` link to the page with no params. If no tokens and zero rows → first-run CTA.

- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/filters/__tests__/tokens.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/filters components/filters app/dashboard/page.tsx app/brand/page.tsx app/deals/page.tsx
git commit -m "$(cat <<'EOF'
fix: URL filter chips and filter-scoped stats on home and deals

Filters were disconnected from the numbers, and missing ratings rendered as blank.
EOF
)"
```

---

### Task 13: Live inventory signal and 3,000-follower waitlist

**Files:**
- Create: `lib/creators/waitlist.ts`
- Create: `lib/creators/__tests__/waitlist.test.ts`
- Modify: `app/onboarding/publish/actions.ts`
- Modify: `app/campaigns/page.tsx` (brand create dialog)
- Modify: `app/brand/page.tsx`
- Modify: `supabase/migrations/0023_feedback_fixes.sql` if a new `creator_profiles.status` value is required

**Interfaces:**

```ts
export const WAITLIST_FOLLOWER_FLOOR = 3000;

export function publishDecision(maxFollowerCount: number | null): "live" | "waitlisted" {
  if (maxFollowerCount === null) return "waitlisted";
  return maxFollowerCount >= WAITLIST_FOLLOWER_FLOOR ? "live" : "waitlisted";
}
```

F15: brands will not create campaigns if they cannot see supply. Show `N live creators` (and optionally `N with short-form posts`) on Brand home and in the new-campaign dialog. F16: below 3,000 followers → waitlist, still in the database, not discoverable as live.

Read `creator_profiles.status` allowed values in `0002_catalog.sql` before adding `waitlisted`. If the check constraint is `draft | live | unpublished`, extend it in `0023`.

- [ ] **Step 1: Failing tests**

```ts
import { describe, it, expect } from "vitest";
import { publishDecision } from "@/lib/creators/waitlist";

describe("publishDecision", () => {
  it("waitlists missing and sub-threshold counts", () => {
    expect(publishDecision(null)).toBe("waitlisted");
    expect(publishDecision(2999)).toBe("waitlisted");
  });
  it("publishes at the floor", () => {
    expect(publishDecision(3000)).toBe("live");
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run lib/creators/__tests__/waitlist.test.ts`

Expected: FAIL

- [ ] **Step 3: Implement**

On publish, load `connected_accounts.follower_count` for the creator, take `max`, call `publishDecision`, write that status. Waitlisted copy: `You are on the waitlist. We will open your storefront when your audience crosses 3,000 followers.`

Discover and creator public storefront already filter non-live; confirm waitlisted is excluded.

Brand home metric tile: count of `creator_profiles` with `status = 'live'` (authenticated query). Campaign dialog: `12 live creators on Clipline` (use the real count). Do not fake a number.

- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/creators/__tests__/waitlist.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/creators app/onboarding/publish app/campaigns/page.tsx app/brand/page.tsx supabase/migrations/0023_feedback_fixes.sql
git commit -m "$(cat <<'EOF'
feat: waitlist creators under 3k followers and show live supply to brands

Brands would not post campaigns when the marketplace looked empty.
EOF
)"
```

---

## Self-review

**Spec coverage**

| Requirement | Task |
|---|---|
| B01 dashboard filter | 12 |
| B02 home leaves the app | 1 |
| B03 home → brand onboarding | 2 |
| B04 Deals missing on mobile | 5 |
| B05 onboarding back | 11 |
| B06 stats missing | 12 |
| B07 Enter in chat | 7 |
| B08 request-changes text | 10 |
| B09 copy | every UI task |
| B10 campaign not visible | 8 |
| B11 booking vs Orders | 8 |
| B12 offering dead-end | 9 |
| B13 template submit state | 8 |
| B14 Send vs Accept | 7 |
| B15 composer memory | 7 |
| B16 thread layout | 6 |
| B17 dash number | 12 |
| F01 F02 password / pin login | 3 |
| F03 required fields + guidance | 11 |
| F04 left menu | 5 |
| F05 inbox side panel | 6 |
| F06 F17 offering gate / recovery | 9 |
| F07 F08 accept preview / 2-step | 10 |
| F09 Deals highlight | 5 |
| F10 notifications findable | 5 (badge on Notifications item) |
| F14 template picker | 8 |
| F15 F16 inventory + waitlist | 13 |
| DESIGN.md App shell | 4, 5 |

**Deferred on purpose:** F11, F12, F13, F18, F19, F20, WhatsApp.

**Placeholder scan:** none. Operator step (Supabase redirect URLs) is explicit in Task 3.

**Type consistency:** `homeForRole`, `inboxCta`, `creatorCanApply`, `publishDecision`, `UiAction.needsNote` / `needsPreview`, `AppShell.pane` are named the same in later tasks as in earlier ones.
