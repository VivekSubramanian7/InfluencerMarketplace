# Data Collection System Design

## Overview

Add PostHog as the analytics platform for Clipline. Instrument custom events at every critical decision point to understand funnel health, deal lifecycle, search demand, and creator storefront performance. Session replay enabled globally.

**Current state:** Vercel Web Analytics only (basic pageviews). No custom event tracking, no funnels, no behavioral data.

**Target state:** PostHog with autocapture, session replay, user identification, and ~25 custom events covering all critical flows.

## Architecture

```
Browser (autocapture + custom events)
  └─ PostHog JS SDK ─────────────────────► PostHog Cloud
Server Actions (deal transitions)           ▲
  └─ PostHog Node SDK ──────────────────────┘
```

PostHog is the single source of truth for behavioral data. Supabase tables hold business data (deals, profiles, revenue) — no duplication into analytics tables.

## Implementation Units

### 1. PostHog Setup

- `PostHogProvider` wrapping the app in `app/layout.tsx`
- `posthog.identify(userId, { role, onboarding_status })` on login/session restore
- Session replay enabled globally (PostHog auto-masks inputs by default)
- `posthog.reset()` on logout
- Server-side: PostHog Node SDK initialized in `lib/analytics.ts` for deal transition events

### 2. Analytics Helpers

New file: `lib/analytics.ts`

Exports:
- `useAnalytics()` — client hook wrapping `posthog.capture()` with typed event names
- `trackServerEvent(eventName, properties)` — server-side capture for deal transitions
- `identifyUser(userId, properties)` — called on login
- `resetAnalytics()` — called on logout

Event names are a string union type for autocomplete and typo prevention.

### 3. Funnel Events

| Event | Where fired | Key properties |
|-------|------------|----------------|
| `signup_started` | Signup page load | `method` |
| `signup_completed` | After account creation | `role`, `method` |
| `onboarding_step_completed` | Each onboarding step | `step_name`, `step_index`, `time_on_step` |
| `onboarding_abandoned` | Detected via session analysis (user started onboarding but never completed within session). Not a real-time event — derived in PostHog from users who have `onboarding_step_completed` but no `onboarding_completed`. | `last_step`, `steps_completed` |
| `onboarding_completed` | Final publish step | `total_time`, `offerings_count` |
| `creator_profile_viewed` | Storefront page | `creator_handle`, `source` (discover/direct/shared) |
| `booking_started` | "Book" button click | `creator_handle`, `offering_id`, `price` |
| `booking_completed` | Deal created | `deal_id`, `value`, `niche`, `format` |

### 4. Deal State Machine Events (Server-Side)

Every deal state transition fires a single event type:

| Event | Properties |
|-------|-----------|
| `deal_state_changed` | `deal_id`, `from_state`, `to_state`, `value`, `niche`, `creator_id`, `brand_id`, `time_in_previous_state` |

Fired from existing deal transition server actions via a `trackDealTransition()` wrapper.

### 5. Search & Discovery Events

| Event | Properties |
|-------|-----------|
| `search_performed` | `query`, `filters` (niche, format, budget_range), `results_count`, `page` |
| `search_zero_results` | `query`, `filters` |
| `search_result_clicked` | `creator_handle`, `position_in_results`, `query` |
| `filter_applied` | `filter_name`, `filter_value` |

Zero-result searches are the highest-signal event for product decisions — they reveal demand with no supply.

### 6. Creator Storefront Analytics

| Event | Properties |
|-------|-----------|
| `storefront_viewed` | `creator_handle`, `source`, `viewer_role` |
| `storefront_section_viewed` | `creator_handle`, `section` (offerings/portfolio/reviews) |
| `offering_viewed` | `creator_handle`, `offering_id`, `price`, `format` |
| `storefront_cta_clicked` | `creator_handle`, `cta_type` (book/message/share) |

These events are the data foundation for a future creator-facing analytics dashboard.

### 7. Engagement Events

| Event | Properties |
|-------|-----------|
| `message_sent` | `conversation_id`, `sender_role` (never message content) |
| `notification_clicked` | `notification_type`, `target_url` |
| `dashboard_section_viewed` | `section`, `role` |

## User Identification

On login or session restore:
```
posthog.identify(userId, {
  role: 'creator' | 'brand' | 'admin',
  onboarding_status: 'incomplete' | 'complete'
})
```

On logout:
```
posthog.reset()
```

This links anonymous pre-signup browsing to the user's account once they sign up.

## Files Touched

| File | Change |
|------|--------|
| `package.json` | Add `posthog-js`, `posthog-node` |
| `lib/analytics.ts` | New: PostHog init, hooks, server helpers, event types |
| `components/providers/posthog-provider.tsx` | New: client provider component |
| `app/layout.tsx` | Wrap app with PostHogProvider |
| `app/(auth)/signup/page.tsx` | `signup_started`, `signup_completed` |
| `app/(auth)/login/page.tsx` | `identifyUser()` on login |
| `app/onboarding/**` | Step completion/abandonment events |
| `app/discover/page.tsx` | Search and filter events |
| `app/c/[handle]/page.tsx` | Storefront view/section/CTA events |
| Deal server actions | `deal_state_changed` via `trackDealTransition()` |
| Auth helpers (`lib/auth/*`) | `identifyUser` on session restore, `resetAnalytics` on logout |
| Inbox/messaging actions | `message_sent` event |
| Notification components | `notification_clicked` event |
| Dashboard pages | `dashboard_section_viewed` event |

## What PostHog Provides for Free (No Custom Code)

- Pageview tracking (autocapture)
- Click tracking on all interactive elements (autocapture)
- Session recordings with auto-masked inputs
- Web vitals (LCP, FID, CLS)
- Bounce rate, time on page
- Device/browser/location breakdown
- Retention and cohort analysis (from identified users)

## What We're NOT Building

- No custom Supabase analytics tables — PostHog is the behavioral data store
- No A/B testing framework — PostHog has feature flags when needed
- No custom dashboards — PostHog's built-in dashboards and insights are sufficient
- No creator-facing analytics UI yet — the events are the foundation; UI comes when creators ask
- No email/notification delivery analytics — only click-through tracking
- No revenue analytics in PostHog — Supabase deal tables are the source of truth for money
- No consent banner implementation — add when preparing for production launch / compliance review

## Privacy Considerations

- Session replay auto-masks input fields by default
- Message content is never captured — only `conversation_id` and `sender_role`
- No PII in event properties beyond user ID (which PostHog needs for identification)
- PostHog is GDPR-compliant and supports data deletion requests
- Consent banner should be added before public launch (out of scope for this spec)

## Success Criteria

After implementation, you should be able to answer:
1. Where do users drop off in signup and onboarding?
2. What do brands search for that doesn't exist? (zero-result searches)
3. Which creator storefronts convert viewers to bookings?
4. Where do deals get stuck in the state machine?
5. What's the time-to-first-booking for new brands and creators?
