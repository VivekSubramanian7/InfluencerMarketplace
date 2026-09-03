# Data Collection System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate PostHog analytics into Clipline with custom events covering signup/onboarding funnels, deal state transitions, search/discovery, creator storefront views, messaging, and notifications.

**Architecture:** PostHog JS SDK on the client (autocapture + custom events + session replay), PostHog Node SDK on the server for deal state machine events. A thin `lib/analytics.ts` module exports typed helpers for both sides. A `<PostHogProvider>` client component wraps the app and handles `identify`/`reset`.

**Tech Stack:** posthog-js (client), posthog-node (server), Next.js 16.3.1, Supabase Auth

**Spec:** `docs/superpowers/specs/2026-09-03-data-collection-design.md`

## Global Constraints

- PostHog project API key and host go in env vars: `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`
- Event names use `snake_case` — all defined as a TypeScript string union in `lib/analytics.ts`
- Never capture message content, passwords, or PII beyond user ID and role
- Session replay is enabled; PostHog auto-masks inputs by default
- Server-side events use `posthog-node` and must call `posthog.shutdown()` is NOT needed per-request — the Node client batches internally
- All server action analytics calls are fire-and-forget (no `await`) — analytics must never block or break user flows

---

### Task 1: Install Dependencies and Create Analytics Module

**Files:**
- Modify: `package.json` — add `posthog-js`, `posthog-node`
- Create: `lib/analytics.ts` — typed event helpers for client and server
- Create: `.env.local.example` — document required env vars

**Interfaces:**
- Consumes: nothing
- Produces:
  - `AnalyticsEvent` — string union of all event names
  - `trackServerEvent(event: AnalyticsEvent, distinctId: string, properties?: Record<string, unknown>): void` — fire-and-forget server-side capture
  - `POSTHOG_KEY` and `POSTHOG_HOST` constants read from `process.env`

- [ ] **Step 1: Install posthog-js and posthog-node**

```bash
npm install posthog-js posthog-node
```

- [ ] **Step 2: Create `lib/analytics.ts`**

```typescript
import "server-only";
import { PostHog } from "posthog-node";

export type AnalyticsEvent =
  | "signup_started"
  | "signup_completed"
  | "onboarding_step_completed"
  | "onboarding_completed"
  | "creator_profile_viewed"
  | "booking_started"
  | "booking_completed"
  | "deal_state_changed"
  | "deal_marked_paid"
  | "deal_review_submitted"
  | "search_performed"
  | "search_zero_results"
  | "search_result_clicked"
  | "filter_applied"
  | "search_saved"
  | "storefront_viewed"
  | "storefront_section_viewed"
  | "storefront_cta_clicked"
  | "offering_viewed"
  | "message_sent"
  | "offer_sent"
  | "offer_accepted"
  | "offer_declined"
  | "invite_sent"
  | "invite_accepted"
  | "invite_declined"
  | "reachouts_sent"
  | "notification_clicked"
  | "dashboard_section_viewed";

let _client: PostHog | null = null;

function getServerClient(): PostHog | null {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return null;
  if (!_client) {
    _client = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      flushAt: 20,
      flushInterval: 10000,
    });
  }
  return _client;
}

export function trackServerEvent(
  event: AnalyticsEvent,
  distinctId: string,
  properties?: Record<string, unknown>,
): void {
  try {
    getServerClient()?.capture({ distinctId, event, properties });
  } catch {
    // ponytail: analytics must never break user flows
  }
}

export function identifyServerUser(
  distinctId: string,
  properties: Record<string, unknown>,
): void {
  try {
    getServerClient()?.identify({ distinctId, properties });
  } catch {
    // ponytail: analytics must never break user flows
  }
}
```

- [ ] **Step 3: Add env var example**

Add to `.env.local.example` (create if not present, or append):
```
NEXT_PUBLIC_POSTHOG_KEY=phc_your_project_key
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: build succeeds with no type errors. The analytics module imports `server-only` so it can only be used in server components/actions.

- [ ] **Step 5: Commit**

```bash
git add lib/analytics.ts package.json package-lock.json .env.local.example
git commit -m "feat: add posthog dependencies and server analytics module"
```

---

### Task 2: PostHog Client Provider and User Identification

**Files:**
- Create: `components/posthog-provider.tsx` — client provider with autocapture + session replay + identify
- Modify: `app/layout.tsx` — wrap children with PostHogProvider
- Create: `lib/analytics-client.ts` — client-side capture helper (no `server-only`)

**Interfaces:**
- Consumes: `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` env vars
- Produces:
  - `<PostHogProvider>` — React client component that initializes PostHog
  - `captureClientEvent(event: string, properties?: Record<string, unknown>): void` — safe client-side capture
  - `identifyClientUser(userId: string, properties: Record<string, unknown>): void`
  - `resetClientAnalytics(): void`

- [ ] **Step 1: Create `lib/analytics-client.ts`**

```typescript
"use client";

import posthog from "posthog-js";

export function captureClientEvent(
  event: string,
  properties?: Record<string, unknown>,
): void {
  try {
    if (typeof window !== "undefined" && posthog.__loaded) {
      posthog.capture(event, properties);
    }
  } catch {
    // ponytail: analytics must never break user flows
  }
}

export function identifyClientUser(
  userId: string,
  properties: Record<string, unknown>,
): void {
  try {
    if (typeof window !== "undefined" && posthog.__loaded) {
      posthog.identify(userId, properties);
    }
  } catch {}
}

export function resetClientAnalytics(): void {
  try {
    if (typeof window !== "undefined" && posthog.__loaded) {
      posthog.reset();
    }
  } catch {}
}
```

- [ ] **Step 2: Create `components/posthog-provider.tsx`**

```typescript
"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { useEffect } from "react";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "";
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

if (typeof window !== "undefined" && KEY) {
  posthog.init(KEY, {
    api_host: HOST,
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: true,
    session_recording: { maskAllInputs: true },
    loaded: (ph) => {
      if (process.env.NODE_ENV === "development") ph.debug();
    },
  });
}

export function PostHogProvider({
  children,
  userId,
  userRole,
}: {
  children: React.ReactNode;
  userId?: string | null;
  userRole?: string | null;
}) {
  return (
    <PHProvider client={posthog}>
      {userId && <PostHogIdentify userId={userId} userRole={userRole} />}
      {children}
    </PHProvider>
  );
}

function PostHogIdentify({
  userId,
  userRole,
}: {
  userId: string;
  userRole?: string | null;
}) {
  const ph = usePostHog();
  useEffect(() => {
    if (userId) {
      ph.identify(userId, { role: userRole ?? undefined });
    }
    return () => {
      // Reset on logout (userId becomes null → component unmounts)
      ph.reset();
    };
  }, [ph, userId, userRole]);
  return null;
}
```

- [ ] **Step 3: Modify `app/layout.tsx` to wrap with PostHogProvider**

The root layout is a server component. It needs to pass user info to the client provider. Use a lightweight server-side user check (the existing `getUserAndRole` pattern from `lib/auth/require.ts` is `cache()`d so it's cheap).

```typescript
import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { PostHogProvider } from "@/components/posthog-provider";
import "./globals.css";

// Import the cached helper — does not redirect, just returns null if no user
async function getUser() {
  try {
    const { createServerSupabase } = await import("@/lib/supabase/server");
    const supabase = await createServerSupabase();
    const { data } = await supabase.auth.getClaims();
    const sub = data?.claims?.sub;
    if (!sub) return null;
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", sub)
      .single();
    return { id: sub, role: profile?.role ?? null };
  } catch {
    return null;
  }
}

export const metadata: Metadata = {
  title: "Clipline | Book video creators",
  description:
    "Book sponsored videos from vetted micro-influencers on YouTube, TikTok, and Instagram.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getUser();

  return (
    <html lang="en" className="h-full scroll-smooth antialiased font-sans">
      <link
        rel="stylesheet"
        precedence="default"
        href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&display=swap"
      />
      <body className="min-h-full flex flex-col">
        <PostHogProvider userId={user?.id} userRole={user?.role}>
          {children}
        </PostHogProvider>
        <Analytics />
      </body>
    </html>
  );
}
```

**Note:** This duplicates a small user lookup already done by `requireUser()`. Because `requireUser` uses React `cache()`, this extra call only costs a DB round-trip on pages that don't already call `requireUser()` (like the landing page, legal pages). The tradeoff is worth it — it means every page identifies the user in PostHog without adding identify calls across every page.

- [ ] **Step 4: Verify build and dev server**

```bash
npm run build
```

Then start dev server, open the app in a browser, and check the browser console for PostHog debug logs (in dev mode). Verify:
- PostHog initializes (look for `[PostHog.js]` logs)
- Autocapture fires pageview events
- If logged in, `identify` is called with your user ID

- [ ] **Step 5: Commit**

```bash
git add components/posthog-provider.tsx lib/analytics-client.ts app/layout.tsx
git commit -m "feat: add PostHog client provider with autocapture and session replay"
```

---

### Task 3: Auth Events — Signup, Login Identify, Logout Reset

**Files:**
- Modify: `app/(auth)/actions.ts` — add `trackServerEvent` / `identifyServerUser` calls
- Modify: `app/auth/callback/route.ts` — identify on OAuth/email verification callback

**Interfaces:**
- Consumes: `trackServerEvent`, `identifyServerUser` from `lib/analytics.ts`
- Produces: `signup_completed` event; server-side identify on login/callback

- [ ] **Step 1: Read current auth actions**

Read `app/(auth)/actions.ts` to see the exact code before editing.

- [ ] **Step 2: Add analytics to `signup` action**

After the `supabase.auth.signUp()` success check and before the redirect, add:

```typescript
import { trackServerEvent } from "@/lib/analytics";

// Inside signup(), after signUp succeeds (before redirect):
trackServerEvent("signup_completed", data.user?.id ?? "anonymous", {
  role,
  method: "email",
});
```

Note: `signup_started` is a client-side event handled by PostHog autocapture (page load on `/signup`).

- [ ] **Step 3: Add identify to `login` action**

After the successful `signInWithPassword()` and profile fetch, before the role redirect:

```typescript
import { identifyServerUser } from "@/lib/analytics";

// Inside login(), after profile fetch:
identifyServerUser(data.user!.id, { role: profile?.role ?? "unknown" });
```

- [ ] **Step 4: Add identify to `app/auth/callback/route.ts`**

After `exchangeCodeForSession()` succeeds and profile role is fetched:

```typescript
import { identifyServerUser } from "@/lib/analytics";

// After profile fetch:
identifyServerUser(data.user.id, { role: profile?.role ?? "unknown" });
```

- [ ] **Step 5: Verify — sign up and log in**

Start dev server. Sign up a test user and log in. Check PostHog debug console or PostHog dashboard for:
- `signup_completed` event with `role` property
- `identify` call linking the user

- [ ] **Step 6: Commit**

```bash
git add app/(auth)/actions.ts app/auth/callback/route.ts
git commit -m "feat: track signup and identify users on login in PostHog"
```

---

### Task 4: Creator Onboarding Funnel Events

**Files:**
- Modify: `app/onboarding/profile/actions.ts` — track profile step
- Modify: `app/onboarding/socials/actions.ts` — track socials step
- Modify: `app/onboarding/offerings/actions.ts` — track offerings step
- Modify: `app/onboarding/highlights/actions.ts` — track highlights step
- Modify: `app/onboarding/publish/actions.ts` — track publish/onboarding completed

**Interfaces:**
- Consumes: `trackServerEvent` from `lib/analytics.ts`; user ID from `requireRole()`
- Produces: `onboarding_step_completed` and `onboarding_completed` events

- [ ] **Step 1: Read all onboarding action files**

Read each file listed above to confirm current code.

- [ ] **Step 2: Add tracking to `saveProfileStep` in `app/onboarding/profile/actions.ts`**

After the successful profile upsert and before the redirect to `/onboarding/socials`:

```typescript
import { trackServerEvent } from "@/lib/analytics";

// After upsertCreatorProfileFromForm succeeds:
trackServerEvent("onboarding_step_completed", user.id, { step: "profile" });
```

- [ ] **Step 3: Add tracking to `addSocialAccount` in `app/onboarding/socials/actions.ts`**

After `register_social_account` RPC succeeds:

```typescript
import { trackServerEvent } from "@/lib/analytics";

// After successful register_social_account:
trackServerEvent("onboarding_step_completed", user.id, { step: "socials", platform });
```

- [ ] **Step 4: Add tracking to `saveOfferingStep` in `app/onboarding/offerings/actions.ts`**

After successful `offerings.insert()`:

```typescript
import { trackServerEvent } from "@/lib/analytics";

// After insert succeeds:
trackServerEvent("onboarding_step_completed", user.id, {
  step: "offerings",
  type,
  price_cents: priceCents,
});
```

- [ ] **Step 5: Add tracking to `addHighlight` in `app/onboarding/highlights/actions.ts`**

After successful `portfolio_items.insert()`:

```typescript
import { trackServerEvent } from "@/lib/analytics";

// After insert succeeds:
trackServerEvent("onboarding_step_completed", user.id, { step: "highlights" });
```

- [ ] **Step 6: Add tracking to `publishStorefront` in `app/onboarding/publish/actions.ts`**

After successful `status: "live"` update:

```typescript
import { trackServerEvent } from "@/lib/analytics";

// After publish succeeds:
trackServerEvent("onboarding_completed", user.id, { handle: row.handle });
```

- [ ] **Step 7: Verify — walk through onboarding**

Start dev server, create a new creator account, walk through all 5 onboarding steps. Check PostHog for:
- 5x `onboarding_step_completed` events (profile, socials, offerings, highlights)
- 1x `onboarding_completed` event

- [ ] **Step 8: Commit**

```bash
git add app/onboarding/profile/actions.ts app/onboarding/socials/actions.ts app/onboarding/offerings/actions.ts app/onboarding/highlights/actions.ts app/onboarding/publish/actions.ts
git commit -m "feat: track creator onboarding funnel steps in PostHog"
```

---

### Task 5: Deal State Machine Events

**Files:**
- Modify: `app/deals/[id]/actions.ts` — track `deal_state_changed` and `deal_marked_paid`
- Modify: `app/deals/[id]/review-actions.ts` — track `deal_review_submitted`

**Interfaces:**
- Consumes: `trackServerEvent` from `lib/analytics.ts`; user context from `requireUser()`
- Produces: `deal_state_changed`, `deal_marked_paid`, `deal_review_submitted` events

- [ ] **Step 1: Read `app/deals/[id]/review-actions.ts`**

Read to confirm the exact code structure.

- [ ] **Step 2: Add tracking to `performDealAction` in `app/deals/[id]/actions.ts`**

After `supabase.rpc("transition_deal", ...)` succeeds (the `if (deal)` block), add:

```typescript
import { trackServerEvent } from "@/lib/analytics";

// Inside the `if (deal)` block, alongside the notify call:
trackServerEvent("deal_state_changed", role === "brand" ? deal.brand_id : deal.creator_id, {
  deal_id: dealId,
  action,
  actor_role: role,
  offering_title: deal.offering_title,
});
```

Note: `deal` is the return from `transition_deal` RPC. The `from_state`/`to_state` aren't directly available from the RPC return — use `action` as the event discriminator instead, which maps 1:1 to state transitions.

- [ ] **Step 3: Add tracking to `markPaid` in `app/deals/[id]/actions.ts`**

After `mark_deal_paid` RPC succeeds:

```typescript
// After rpc succeeds, before revalidatePath:
const { user } = await requireUser();  // already called at top — reuse
trackServerEvent("deal_marked_paid", user.id, { deal_id: dealId });
```

Wait — `markPaid` calls `requireUser()` but doesn't destructure `user`. Change the existing `await requireUser()` to `const { user } = await requireUser()` and add:

```typescript
trackServerEvent("deal_marked_paid", user.id, { deal_id: dealId });
```

- [ ] **Step 4: Add tracking to `submitReview` in `app/deals/[id]/review-actions.ts`**

After successful `reviews.insert()`:

```typescript
import { trackServerEvent } from "@/lib/analytics";

// After insert succeeds:
trackServerEvent("deal_review_submitted", user.id, {
  deal_id: dealId,
  rating,
  has_body: !!body.value,
});
```

- [ ] **Step 5: Verify — trigger a deal transition**

In the dev environment, create a deal and transition it through at least one state. Check PostHog for `deal_state_changed` event with correct properties.

- [ ] **Step 6: Commit**

```bash
git add app/deals/[id]/actions.ts app/deals/[id]/review-actions.ts
git commit -m "feat: track deal state transitions and reviews in PostHog"
```

---

### Task 6: Search & Discovery Events

**Files:**
- Create: `app/discover/search-tracker.tsx` — client component that fires `search_performed` / `search_zero_results` on mount
- Modify: `app/discover/page.tsx` — render `<SearchTracker>` with search metadata
- Modify: `app/discover/actions.ts` — track `reachouts_sent`, `search_saved`

**Interfaces:**
- Consumes: `captureClientEvent` from `lib/analytics-client.ts`; `trackServerEvent` from `lib/analytics.ts`
- Produces: `search_performed`, `search_zero_results`, `reachouts_sent`, `search_saved` events

- [ ] **Step 1: Read `app/discover/page.tsx`**

Read to understand how search results and filters are rendered.

- [ ] **Step 2: Create `app/discover/search-tracker.tsx`**

This is a client component that fires a search event on mount. The server component passes search metadata as props.

```typescript
"use client";

import { useEffect, useRef } from "react";
import { captureClientEvent } from "@/lib/analytics-client";

export function SearchTracker({
  query,
  filters,
  totalResults,
  page,
}: {
  query: string | null;
  filters: Record<string, string | null>;
  totalResults: number;
  page: number;
}) {
  const tracked = useRef(false);
  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;

    const props = {
      query,
      ...filters,
      results_count: totalResults,
      page,
    };
    captureClientEvent("search_performed", props);
    if (totalResults === 0) {
      captureClientEvent("search_zero_results", props);
    }
  }, [query, filters, totalResults, page]);

  return null;
}
```

- [ ] **Step 3: Add `<SearchTracker>` to `app/discover/page.tsx`**

After the search results are fetched, render the tracker:

```typescript
import { SearchTracker } from "./search-tracker";

// Inside the component return, alongside existing JSX:
<SearchTracker
  query={filters.q}
  filters={{
    niche: filters.niche,
    country: filters.country,
    type: filters.type,
    min_price: filters.minPriceCents?.toString() ?? null,
    max_price: filters.maxPriceCents?.toString() ?? null,
  }}
  totalResults={total}
  page={page}
/>
```

- [ ] **Step 4: Add tracking to `sendReachouts` in `app/discover/actions.ts`**

After the send loop completes, before redirect:

```typescript
import { trackServerEvent } from "@/lib/analytics";

// After the loop, before redirect:
trackServerEvent("reachouts_sent", user.id, {
  sent_count: sent,
  attempted_count: creatorIds.length,
});
```

- [ ] **Step 5: Add tracking to `saveSearch` in `app/discover/actions.ts`**

After successful `saved_filters.insert()`:

```typescript
trackServerEvent("search_saved", user.id, {
  name,
  filter_count: Object.keys(params).length,
});
```

- [ ] **Step 6: Verify — search on discover page**

Start dev, go to `/discover`, apply filters, search. Check PostHog for `search_performed`. Search for something with no results and verify `search_zero_results` fires.

- [ ] **Step 7: Commit**

```bash
git add app/discover/search-tracker.tsx app/discover/page.tsx app/discover/actions.ts
git commit -m "feat: track search, discovery, and reachout events in PostHog"
```

---

### Task 7: Creator Storefront Analytics

**Files:**
- Create: `app/c/[handle]/storefront-tracker.tsx` — client component tracking storefront views and section visibility
- Modify: `app/c/[handle]/page.tsx` — render `<StorefrontTracker>`
- Modify: `app/c/[handle]/actions.ts` — track `invite_sent`

**Interfaces:**
- Consumes: `captureClientEvent` from `lib/analytics-client.ts`; `trackServerEvent` from `lib/analytics.ts`
- Produces: `storefront_viewed`, `storefront_section_viewed`, `storefront_cta_clicked`, `invite_sent` events

- [ ] **Step 1: Read `app/c/[handle]/page.tsx` and `app/c/[handle]/actions.ts`**

Read both to understand the storefront structure and invite action.

- [ ] **Step 2: Create `app/c/[handle]/storefront-tracker.tsx`**

Fires `storefront_viewed` on mount. Uses `IntersectionObserver` for section visibility.

```typescript
"use client";

import { useEffect, useRef } from "react";
import { captureClientEvent } from "@/lib/analytics-client";

export function StorefrontTracker({
  creatorHandle,
  offeringsCount,
  reviewCount,
  viewerRole,
}: {
  creatorHandle: string;
  offeringsCount: number;
  reviewCount: number;
  viewerRole: string | null;
}) {
  const tracked = useRef(false);
  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    captureClientEvent("storefront_viewed", {
      creator_handle: creatorHandle,
      offerings_count: offeringsCount,
      review_count: reviewCount,
      viewer_role: viewerRole,
    });
  }, [creatorHandle, offeringsCount, reviewCount, viewerRole]);

  return null;
}

export function SectionTracker({
  section,
  creatorHandle,
  children,
}: {
  section: string;
  creatorHandle: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const tracked = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !tracked.current) {
          tracked.current = true;
          captureClientEvent("storefront_section_viewed", {
            creator_handle: creatorHandle,
            section,
          });
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [section, creatorHandle]);

  return <div ref={ref}>{children}</div>;
}
```

- [ ] **Step 3: Add `<StorefrontTracker>` to `app/c/[handle]/page.tsx`**

Render `<StorefrontTracker>` at the top of the page return with props from the fetched storefront data. Wrap key sections (offerings, reviews, portfolio) with `<SectionTracker>`.

```typescript
import { StorefrontTracker, SectionTracker } from "./storefront-tracker";

// At the top of the JSX return:
<StorefrontTracker
  creatorHandle={handle}
  offeringsCount={offerings.length}
  reviewCount={ratingCount}
  viewerRole={role}
/>

// Wrap the offerings section:
<SectionTracker section="offerings" creatorHandle={handle}>
  {/* existing offerings JSX */}
</SectionTracker>

// Wrap the reviews section:
<SectionTracker section="reviews" creatorHandle={handle}>
  {/* existing reviews JSX */}
</SectionTracker>

// Wrap the portfolio section:
<SectionTracker section="portfolio" creatorHandle={handle}>
  {/* existing portfolio JSX */}
</SectionTracker>
```

- [ ] **Step 4: Add tracking to `inviteFromStorefront` in `app/c/[handle]/actions.ts`**

After successful `conversations.insert()`:

```typescript
import { trackServerEvent } from "@/lib/analytics";

// After insert succeeds:
trackServerEvent("invite_sent", user.id, {
  creator_handle: handle,
  creator_id: creatorId,
  source: "storefront",
});
```

- [ ] **Step 5: Verify — visit a creator storefront**

Start dev, visit a creator's storefront page. Scroll through sections. Check PostHog for `storefront_viewed` and `storefront_section_viewed` events.

- [ ] **Step 6: Commit**

```bash
git add app/c/[handle]/storefront-tracker.tsx app/c/[handle]/page.tsx app/c/[handle]/actions.ts
git commit -m "feat: track creator storefront views and section visibility in PostHog"
```

---

### Task 8: Messaging, Offers, and Invite Response Events

**Files:**
- Modify: `app/inbox/actions.ts` — track `message_sent`, `offer_sent`, `offer_accepted`, `offer_declined`, `invite_accepted`, `invite_declined`

**Interfaces:**
- Consumes: `trackServerEvent` from `lib/analytics.ts`
- Produces: 6 event types from inbox actions

- [ ] **Step 1: Read `app/inbox/actions.ts`**

Read the full file to identify all action functions.

- [ ] **Step 2: Add tracking to `sendThreadMessage`**

After `messages.insert()` succeeds:

```typescript
import { trackServerEvent } from "@/lib/analytics";

// After insert, before notify:
trackServerEvent("message_sent", user.id, {
  conversation_id: conversationId,
  sender_role: role,
});
```

Note: need the `role` — check if `requireUser()` returns it here. If it only returns `user`, change to destructure role too or use a separate lookup. The `requireUser` function returns `{ user, role }`.

- [ ] **Step 3: Add tracking to `sendOffer`**

After `offers.insert()` succeeds:

```typescript
trackServerEvent("offer_sent", user.id, {
  conversation_id: conversationId,
  price_cents: price,
});
```

Note: `sendOffer` uses `requireRole("brand")` which doesn't return `user`. Check the actual return — if it returns `{ user }`, use `user.id`. Otherwise adjust.

- [ ] **Step 4: Add tracking to `respondOffer`**

For accepted (after `accept_offer` RPC):
```typescript
trackServerEvent("offer_accepted", user.id, { offer_id: offerId, deal_id: dealId });
```

For declined (after `offers.update()`):
```typescript
trackServerEvent("offer_declined", user.id, { offer_id: offerId });
```

- [ ] **Step 5: Add tracking to `respondInvite`**

After `conversations.update()` succeeds, before notify:

```typescript
const event = response === "accepted" ? "invite_accepted" as const : "invite_declined" as const;
trackServerEvent(event, user.id, { conversation_id: id });
```

- [ ] **Step 6: Verify — send a message in inbox**

Start dev, open an existing conversation, send a message. Check PostHog for `message_sent` event.

- [ ] **Step 7: Commit**

```bash
git add app/inbox/actions.ts
git commit -m "feat: track messaging, offer, and invite events in PostHog"
```

---

### Task 9: Notification Click Tracking

**Files:**
- Modify: `app/notifications/actions.ts` — track `notification_clicked`

**Interfaces:**
- Consumes: `trackServerEvent` from `lib/analytics.ts`
- Produces: `notification_clicked` event

- [ ] **Step 1: Read `app/notifications/actions.ts`**

Read to confirm exact code.

- [ ] **Step 2: Add tracking to `markReadAndGo`**

Before the redirect:

```typescript
import { trackServerEvent } from "@/lib/analytics";

// Before redirect(href):
trackServerEvent("notification_clicked", user.id, {
  notification_id: id,
  destination: href,
});
```

- [ ] **Step 3: Verify — click a notification**

Start dev, trigger a notification, click it. Check PostHog for `notification_clicked` event.

- [ ] **Step 4: Commit**

```bash
git add app/notifications/actions.ts
git commit -m "feat: track notification clicks in PostHog"
```

---

### Task 10: Smoke Test and Cleanup

**Files:**
- No new files — verification and final check

**Interfaces:**
- Consumes: all events from Tasks 1-9
- Produces: verified working analytics pipeline

- [ ] **Step 1: Run full build**

```bash
npm run build
```

Expected: clean build, no type errors.

- [ ] **Step 2: Run existing tests**

```bash
npm test
```

Expected: all existing tests pass. Analytics calls are fire-and-forget and should not affect test behavior.

- [ ] **Step 3: Manual smoke test — full user journey**

Walk through the complete flow in dev:
1. Visit landing page (autocapture pageview)
2. Sign up as creator → check `signup_completed`
3. Walk through onboarding → check 4-5x `onboarding_step_completed` + `onboarding_completed`
4. Visit your own storefront → check `storefront_viewed`
5. Log out, log in as brand → check `identify`
6. Search on discover → check `search_performed`
7. View a creator storefront → check `storefront_viewed`, `storefront_section_viewed`
8. Send a message → check `message_sent`

- [ ] **Step 4: Verify session replay**

Go to PostHog dashboard → Session Recordings. Verify at least one recording from your smoke test appears with masked inputs.

- [ ] **Step 5: Final commit if any cleanup needed**

```bash
git add -A
git commit -m "chore: analytics smoke test cleanup"
```
