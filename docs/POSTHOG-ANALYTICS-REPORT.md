# PostHog Analytics Report — InfluencerMarketplace
**Date:** 2026-09-05

---

## Current State

### Web Overview (last 28 days)
| Metric | Value |
|---|---|
| Visitors | 2 |
| Sessions | 6 |
| Page views | 7 |
| Avg session duration | 93.5s |
| Bounce rate | 16.7% |

> All data is from a single test session (2026-09-05). Treat as instrumentation validation, not product insight. Statistics below are single observations — do not read significance into them.

### Custom Events Being Tracked
- `notification_clicked`
- `deal_state_changed` / `deal_review_submitted`
- `message_sent`
- `search_performed`
- `invite_sent` / `invite_accepted`
- `storefront_viewed` / `storefront_section_viewed`
- `$pageview`, `$identify`, `$web_vitals`, `$dead_click`, `$rageclick`, `$autocapture`

---

## Flow Latency Analysis

> N=1 for all flows. Values shown are single observations, not averages.

### 1. Deal Execution Flow (`deal_state_changed`)

| Transition | Observed latency | Count |
|---|---|---|
| `accept → begin_production` | 4s | 1 |
| `begin_production → submit_preview` | 8s | 1 |
| `submit_preview → request_revision` | 12–14s | 2 |
| `request_revision → submit_preview` | 19–36s | 2 |
| `submit_preview → mark_published` | 17s | 1 |
| `mark_published → approve` | 8s | 1 |

The revision loop (`request_revision → submit_preview`) is the slowest step — expected to be hours/days with real users.

### 2. Invite Flow

| Transition | Observed latency |
|---|---|
| `invite_sent → invite_accepted` | 6s (1 observation) |

Matching is fragile: `invite_sent` carries `creator_id`; `invite_accepted` carries only `conversation_id`. See gap #2 below.

### 3. Discovery Flow (`storefront_viewed → engagement`)

| Transition | Observed latency |
|---|---|
| `storefront_viewed → invite_sent` | 1s |
| `storefront_viewed → message_sent` | 37s |

### 4. Click → Action Latency (`$autocapture → custom event`)

| Action triggered | Latency | Clicked element | Page |
|---|---|---|---|
| `search_performed` | 1.4s | "Discover" button | `/brand` |
| `search_performed` | 19.6s | Message in inbox | `/inbox` |
| `storefront_viewed` | 173s (2.9 min) | Notification text | `/notifications` |

---

## Instrumentation Gaps

1. **No `duration_ms` property on any event** — client-side interaction latency (page load, API response) is unmeasurable without it.

2. **`invite_sent` / `invite_accepted` have no shared key** — `invite_sent` (`app/c/[handle]/actions.ts:46`) carries `creator_id` but no `conversation_id`. `invite_accepted` (`app/inbox/actions.ts:33`) carries `conversation_id` but no `creator_id`. A consistent key on both events is needed for reliable funnel matching.

3. **`deal_review_submitted` and `search_performed` fired zero times during testing** — both are correctly wired (`app/deals/[id]/review-actions.ts:35` and `app/discover/search-tracker.tsx:28`). The test session simply didn't exercise those paths. Not a code bug — a test coverage gap.

4. **71% of autocapture clicks have no `$el_text`** — icon buttons, image buttons, and form submits have no visible text. Only 3 sessions could be matched to a downstream action.

5. **No `deal_created` event** — deals are created inside Supabase RPCs (`accept_offer`, `accept_campaign_application`), but no analytics event fires after either call. The app tracks `offer_accepted` in `app/inbox/actions.ts:158` but this isn't the same as knowing a deal was created, and the campaign-application path (`app/campaigns/[id]/actions.ts:97–116`) has no analytics call at all.

6. **Web Vitals route breakdown unverified** — `$web_vitals` fires, but whether `$pathname` is included as a property needs confirmation in PostHog before claiming a zero-effort win.

---

## Recommended KPIs to Add

### 1. `deal_created` event on both deal-creation paths (highest analytical value)

Deals are created in two places — both via Supabase RPCs that return a deal ID:
- `app/inbox/actions.ts:151` — `accept_offer` (brand offer accepted by creator)
- `app/campaigns/[id]/actions.ts:98` — `accept_campaign_application` (brand accepts creator application)

```ts
// After each supabase.rpc call that returns a dealId:
trackServerEvent("deal_created", userId, {
  deal_id: dealId,
  source: "offer" | "campaign_application",
  // plus any available context: price, offering_type, etc.
});
```

Without this, the deal funnel has no entry point — you can only see state transitions after creation.

### 2. Fix shared key on invite events

**`invite_sent`** (`app/c/[handle]/actions.ts:46`): The `supabase.from("conversations").insert()` on line 31 doesn't return the created row. Change to `.insert(...).select("id").single()` and add `conversation_id` to the event properties.

**`invite_accepted`** (`app/inbox/actions.ts:33`): Add `creator_id: user.id` to the event properties (already available in scope).

### 3. Timing properties on existing events

Add `duration_ms` to these events:

| Event | What to measure | Where |
|---|---|---|
| `message_sent` | Time from compose focus → send | `app/inbox/actions.ts` (needs client-side timer in composer component) |
| `search_performed` | Time from navigation/filter change → render | `app/discover/search-tracker.tsx` (timestamp from page load) |
| `deal_state_changed` | RPC response time | `app/deals/[id]/actions.ts:57` (wrap `supabase.rpc` call) |
| `invite_sent` | Click → server confirmation | `app/c/[handle]/actions.ts` (wrap insert call) |
| `storefront_viewed` | Navigation → content painted | Client-side, needs `performance.now()` in storefront page |

### 4. Web Vitals breakdown by route

Confirm `$pathname` is a property on `$web_vitals` events in PostHog. If yes, create a breakdown insight — zero code change. If not, add it in the PostHog provider config.

| Metric | High-risk route |
|---|---|
| LCP (Largest Contentful Paint) | `/c/[handle]` storefronts |
| INP (Interaction to Next Paint) | `/deals/[id]` review/revision UI |
| CLS (Cumulative Layout Shift) | `/notifications` (dynamic list) |

### 5. API error tracking

```ts
posthog.capture('api_error', {
  endpoint: '/api/deals/:id',
  status_code: 500,
  duration_ms: 340,
  action: 'deal_state_changed'
})
```

No `$exception` or error events exist. Silent failures are invisible.

### 6. `button_clicked` with identity (fixes 71% null-text problem)

```ts
posthog.capture('button_clicked', {
  button_name: 'send_invite',
  page: '/c/mayachen',
  context: 'storefront'
})
```

Add to the 5 highest-value CTAs: send_invite, send_message, accept_deal, submit_preview, send_offer.

### 7. Session quality signals

| Addition | Value |
|---|---|
| `$session_id` on all server events | Joins client clicks to server actions in the same session |
| `time_to_first_action` person property | Identifies fast vs. slow onboarding cohorts |
| `app_loaded` event with `duration_ms` | Measures cold start time per deploy |

---

## Priority Order

| Priority | Change | Effort | Unlocks |
|---|---|---|---|
| 1 | `deal_created` event on both creation paths | 30 min | Full deal funnel from creation to completion |
| 2 | Fix `invite_sent`/`invite_accepted` shared key | 30 min | Reliable invite funnel matching |
| 3 | `duration_ms` on existing events | 1 day | Latency histograms per action |
| 4 | Web Vitals breakdown by route | 0–30 min | Slow route identification |
| 5 | `api_error` event | 1 day | Root cause analysis for slow sessions |
| 6 | `button_clicked` on 5 key CTAs | 1 day | Click → action attribution |
| 7 | Funnel bookend events (`deal_viewed`, `invite_modal_opened`, etc.) | 2 days | True funnel drop-off analysis |
