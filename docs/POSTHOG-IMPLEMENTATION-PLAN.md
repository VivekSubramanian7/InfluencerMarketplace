# PostHog Instrumentation — Implementation Plan

Priorities 1–4 from the analytics report. Each is a standalone PR.

---

## Phase 1: `deal_created` event (30 min)

**Problem:** Deals are created inside two Supabase RPCs but no analytics event fires. The deal funnel has no entry point.

### Files to modify

**`app/inbox/actions.ts`** — `respondOffer()` (line ~158)

After `trackServerEvent("offer_accepted", ...)`, add:

```ts
trackServerEvent("deal_created", user.id, {
  deal_id: dealId,
  source: "offer",
  offer_id: offerId,
  conversation_id: conversationId,
});
```

**`app/campaigns/[id]/actions.ts`** — `decideApplication()` (line ~98)

After `supabase.rpc("accept_campaign_application")` succeeds, add:

```ts
trackServerEvent("deal_created", app.creator_id, {
  deal_id: dealId,
  source: "campaign_application",
  campaign_id: campaignId,
  application_id: id,
});
```

Requires importing `trackServerEvent` (not currently imported in this file).

**`app/campaigns/[id]/actions.ts`** — `bulkDecideApplications()` (line ~160)

Same pattern inside the `decision === "accepted"` loop. The `app` variable is already fetched on line ~165.

**`lib/analytics.ts`** — add `"deal_created"` to the `AnalyticsEvent` union.

### Verify

Create a deal via offer acceptance and via campaign application acceptance. Confirm `deal_created` appears in PostHog with correct `source` and `deal_id`.

---

## Phase 2: Fix invite shared key (30 min)

**Problem:** `invite_sent` has `creator_id` but no `conversation_id`. `invite_accepted` has `conversation_id` but no `creator_id`. Neither can be reliably joined.

### Files to modify

**`app/c/[handle]/actions.ts`** — `inviteFromStorefront()` (line ~31)

Change:
```ts
const { error } = await supabase.from("conversations").insert({...});
```
To:
```ts
const { data: conv, error } = await supabase.from("conversations").insert({...}).select("id").single();
```

Then update the `trackServerEvent` call (line ~46) to include `conversation_id: conv.id`.

**`app/inbox/actions.ts`** — `respondInvite()` (line ~33)

Add `creator_id: user.id` to the event properties:
```ts
trackServerEvent(event, user.id, { conversation_id: id, creator_id: user.id });
```

### Verify

Send an invite, accept it. Confirm both events share `conversation_id` AND `creator_id`. Build a funnel in PostHog joining on `conversation_id`.

---

## Phase 3: `duration_ms` on server-side events (1 day)

**Problem:** No event carries timing data. Can't measure latency.

### Approach

For server actions, wrap the Supabase RPC/insert call with `Date.now()` before and after. Add `duration_ms: end - start` to the event properties.

### Files to modify

**`app/deals/[id]/actions.ts`** — `performDealAction()` (line ~57)

```ts
const t0 = Date.now();
const { data: deal, error } = await supabase.rpc("transition_deal", {...});
const duration_ms = Date.now() - t0;
// ... later in trackServerEvent:
trackServerEvent("deal_state_changed", ..., { ..., duration_ms });
```

**`app/c/[handle]/actions.ts`** — `inviteFromStorefront()` (line ~31)

Same pattern around the `conversations` insert. Add `duration_ms` to `invite_sent`.

**`app/inbox/actions.ts`** — `sendThreadMessage()` (line ~59)

Same pattern around the `messages` insert. Add `duration_ms` to `message_sent`.

**`app/discover/search-tracker.tsx`** — client-side timing

Accept an optional `pageLoadedAt` prop (timestamp from the page component). Compute `duration_ms: Date.now() - pageLoadedAt` and include it in the `search_performed` event.

### Verify

Perform each action in dev. Confirm `duration_ms` appears on each event in PostHog and is a reasonable number (not 0, not negative).

---

## Phase 4: Web Vitals route breakdown (0–30 min)

**Problem:** `$web_vitals` fires but we don't know if `$pathname` is included.

### Steps

1. Open PostHog → Events → filter `$web_vitals` → check if `$pathname` property exists on recent events.
2. **If yes:** Create a PostHog insight: breakdown `$web_vitals` by `$pathname`, filter to LCP/INP/CLS. Done, no code.
3. **If no:** The PostHog Next.js integration should include it automatically. Check the `PostHogProvider` config and ensure `capture_pageleave: true` and `capture_pageview: true` are set. If `$pathname` is still missing, file a PostHog support question — this is expected to work out of the box.

### No code changes expected.

---

## Not in scope (add when needed)

- **`api_error` event** — requires a centralized error boundary or fetch wrapper. Add when real user traffic produces error patterns to investigate.
- **`button_clicked` on CTAs** — lower ROI than fixing the existing event gaps. Add when autocapture null-text becomes a real analysis blocker.
- **Funnel bookend events** (`deal_viewed`, `invite_modal_opened`) — add when there's enough traffic to make drop-off analysis meaningful.
- **Session quality signals** (`$session_id` on server events, `app_loaded`) — add when debugging cross-client/server session stitching.
