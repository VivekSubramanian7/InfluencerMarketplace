# Unified Deal Flow

**Date:** 2026-09-05
**Status:** Draft
**Scope:** Restructure deal creation, messaging, and state machine into a single unified flow

---

## Problem

Three entry paths (direct booking, inbox offer, campaign application) each create
deals with their own bespoke code. This causes:

- **Double-accept friction:** Offer and campaign deals land in `requested`, forcing
  the creator to accept again on the deal page even though they already consented.
- **Two messaging systems:** `messages` table serves both `conversation_id` (inbox)
  and `deal_id` (deal thread) via separate server actions with near-identical logic.
- **Diverging brief quality:** Direct booking gets a rich brief; offer deals get a
  note or placeholder string; campaign deals get a synthesized brief.
- **Duplicated constants:** `STATUS_LABELS` defined in two page files. `ACTION_TITLES`
  in a third. `DEAL_STEPS` in a fourth.
- **Revision note saved twice:** Once via the RPC payload, once via a separate UPDATE.
- **Missing analytics:** `createBooking()` doesn't track `deal_created`.

## Decisions

1. Keep all three entry journeys (booking, offer, campaign). Unify the plumbing.
2. One continuous conversation thread per brand-creator pair. Deals link to it.
3. Deal state changes appear as system messages in the conversation thread.
4. Always require a brief (goals mandatory, product/talking points optional).
5. Simplify to 8 states: drop `funded` and `in_production`.
6. Add `approve_preview` as a signal action (no state change, notification + system message).

---

## 1. State Machine

### 8 States

| State | Who acts next | Meaning |
|-------|--------------|---------|
| `requested` | Creator | Brand booked. Creator hasn't responded. |
| `accepted` | Creator | Creator accepted. Production underway. |
| `submitted` | Brand | Preview submitted for review. |
| `revision_requested` | Creator | Brand asked for changes (note attached). |
| `published` | Brand | Content is live. Awaiting brand approval. |
| `completed` | -- | Done. Reviews can be left. |
| `cancelled` | -- | Terminal. Declined, expired, or cancelled. |
| `disputed` | Admin | Dispute opened. Admin resolves. |

### Removed

- **`funded`** -- Escrow mode is not live. Every deal is created as `off_platform`.
  When escrow ships, re-introduce as a sub-gate on `requested` (or a boolean flag).
- **`in_production`** -- Was a manual "Start production" click that gated nothing.
  Creator can now submit a preview directly from `accepted`.

### Transitions

```
from                  action              to                    actor     mode
----                  ------              --                    -----     ----
requested             accept              accepted              creator   null
requested             decline             cancelled             creator   null
requested             expire_accept       cancelled             system    null
requested             cancel              cancelled             brand     null

accepted              submit_preview      submitted             creator   null
accepted              cancel              cancelled             brand     null
accepted              cancel              cancelled             creator   null

submitted             request_revision    revision_requested    brand     null
submitted             approve_preview     submitted             brand     null  (signal only)
submitted             mark_published      published             creator   null

revision_requested    submit_preview      submitted             creator   null

published             approve             completed             brand     null
published             auto_approve        completed             system    null

-- disputes from any active state
accepted              dispute             disputed              brand     null
accepted              dispute             disputed              creator   null
submitted             dispute             disputed              brand     null
submitted             dispute             disputed              creator   null
revision_requested    dispute             disputed              brand     null
revision_requested    dispute             disputed              creator   null
published             dispute             disputed              brand     null
published             dispute             disputed              creator   null

disputed              resolve_release     completed             admin     null
disputed              resolve_refund      cancelled             admin     null
```

### `approve_preview` Behavior

Not a state transition. When brand clicks "Approve preview" on a `submitted` deal:

1. Insert `deal_events` row: `{ action: 'approve_preview', from_status: 'submitted', to_status: 'submitted' }`
2. Insert system message in conversation: "Brand approved the preview -- clear to publish"
3. Notify creator
4. When `revision_count >= revision_limit`, hide "Request changes" button; only show "Approve preview"

### Timers (pg_cron, unchanged pattern)

- **72h accept deadline:** `requested` + `requested_at < now() - 72h` -> `expire_accept`
- **5-day auto-approve:** `published` + `published_at < now() - 5 days` -> `auto_approve`

---

## 2. One Conversation Per Relationship

### Current State

- `conversations` table: one row per brand-creator pair (unique constraint exists)
- `messages` table: `deal_id` OR `conversation_id` (mutual exclusion constraint)
- Two server actions: `sendThreadMessage()` for inbox, `sendMessage()` for deals
- Deal page shows conversation messages in a collapsed section (if the deal came from an offer)

### Target State

Every brand-creator pair has one conversation. All messages -- pre-deal chat, deal
discussion, and system status updates -- live in that single thread.

### Schema Changes

**`deals` table:**
```sql
ALTER TABLE deals ADD COLUMN conversation_id uuid REFERENCES conversations(id);
```

- Populated on deal creation (all three paths)
- For direct bookings where no conversation exists, auto-create one with
  `status = 'accepted'` and `invite_message` set to the brief goals

**`messages` table:**
```sql
ALTER TABLE messages ADD COLUMN kind text NOT NULL DEFAULT 'message'
  CHECK (kind IN ('message', 'system'));
ALTER TABLE messages ADD COLUMN deal_id_ref uuid REFERENCES deals(id);
ALTER TABLE messages ALTER COLUMN sender_id DROP NOT NULL;
-- sender_id is null for system messages
```

- Drop the `deal_id` column (replaced by conversation routing)
- Add `deal_id_ref` (nullable) for system messages that reference a specific deal
  (a conversation can have multiple deals over time)
- `kind = 'system'` + `sender_id IS NULL` = system-generated status message
- The old mutual-exclusion constraint `(deal_id IS NULL) <> (conversation_id IS NULL)`
  is dropped; all messages have `conversation_id`

**Migration strategy:** Existing `messages` with `deal_id` set:
1. Look up the deal's brand_id + creator_id
2. Find or create the conversation for that pair
3. Set `conversation_id` to that conversation, move `deal_id` to `deal_id_ref`
4. Drop the old `deal_id` column and constraint

### System Messages

When `transition_deal` fires (or via a trigger on `deal_events` insert):

```sql
INSERT INTO messages (conversation_id, sender_id, body, kind, deal_id_ref)
VALUES (
  v_deal.conversation_id,
  NULL,  -- system
  <human-readable text>,
  'system',
  v_deal.id
);
```

Human-readable templates:

| Action | System message |
|--------|---------------|
| accept | "Creator accepted the deal" |
| decline | "Creator declined the deal" |
| submit_preview | "Preview submitted: [url]" |
| approve_preview | "Brand approved the preview -- clear to publish" |
| request_revision | "Brand requested changes: [note]" |
| mark_published | "Content published: [url]" |
| approve | "Brand approved -- deal complete" |
| auto_approve | "Auto-approved after 5 days" |
| cancel | "[Actor] cancelled the deal" |
| dispute | "[Actor] opened a dispute" |
| expire_accept | "Deal expired (no response in 72h)" |

### Server Action Consolidation

- **Delete** `app/deals/[id]/message-actions.ts`
- **Keep** `app/inbox/actions.ts:sendThreadMessage()` as the single message sender
- Deal page's message form posts to `sendThreadMessage` with the conversation_id
  from the deal record

### Deal Page Thread Display

- Fetch messages where `conversation_id = deal.conversation_id`
- Optionally filter to messages after the deal was created (or show full history
  with a "conversation started" divider)
- System messages render as compact inline status updates (no avatar, muted style)
- User messages render as before

---

## 3. Unified Deal Creation

### New RPC: `create_deal`

```sql
CREATE FUNCTION create_deal(
  p_brand_id      uuid,
  p_creator_id    uuid,
  p_offering_id   uuid,
  p_price_cents   bigint,        -- may differ from offering listing price
  p_brief         jsonb,         -- { goals, product_description?, talking_points? }
  p_source        text,          -- 'booking' | 'offer' | 'campaign'
  p_source_meta   jsonb,         -- { offer_id?, campaign_id?, application_id?, conversation_id? }
  p_initial_status text DEFAULT 'requested'  -- 'requested' or 'accepted'
) RETURNS uuid
```

**Responsibilities (single transaction):**
1. Validate offering exists and is active
2. Insert deal row (snapshot offering fields, apply `p_price_cents`)
3. Insert brief row from `p_brief`
4. Find or create conversation for the brand-creator pair; set `deal.conversation_id`
5. Insert deal_event (`deal_created`, metadata = p_source_meta)
6. Insert system message ("New deal: [offering_title]" or "Deal started: [offering_title]")
7. Return the deal id

### Caller Refactoring

**Direct booking** (`app/book/[offeringId]/actions.ts`):
```
createBooking(formData)
  -> validate brief fields
  -> supabase.rpc('create_deal', {
       p_initial_status: 'requested',
       p_source: 'booking',
       p_brief: { goals, product_description, talking_points }
     })
  -> notify creator
  -> trackServerEvent('deal_created', { source: 'booking' })
  -> redirect to /deals/{id}
```

**Offer acceptance** (`app/inbox/actions.ts:respondOffer()`):
```
respondOffer(formData) where response = 'accepted'
  -> supabase.rpc('accept_offer', { p_offer_id })
     accept_offer internally calls create_deal with:
       p_initial_status: 'accepted'
       p_source: 'offer'
       p_brief: from offer's brief fields (goals, product_description, talking_points)
  -> notify brand
  -> trackServerEvent('deal_created', { source: 'offer' })
  -> redirect to /deals/{id}
```

**Campaign acceptance** (`app/campaigns/[id]/actions.ts:decideApplication()`):
```
decideApplication(formData) where decision = 'accepted'
  -> supabase.rpc('accept_campaign_application', { p_application_id })
     accept_campaign_application internally calls create_deal with:
       p_initial_status: 'accepted'
       p_source: 'campaign'
       p_brief: { goals: campaign.description, talking_points: app.pitch }
  -> notify creator
  -> trackServerEvent('deal_created', { source: 'campaign' })
  -> redirect to /deals/{id}
```

### Offer Brief Fields

`sendOffer()` currently accepts: `offering_id`, `price_cents`, `note`.

Change to: `offering_id`, `price_cents`, `goals` (required), `product_description`
(optional), `talking_points` (optional).

**Schema change:**
```sql
ALTER TABLE offers ADD COLUMN goals text CHECK (length(goals) BETWEEN 1 AND 2000);
ALTER TABLE offers ADD COLUMN product_description text CHECK (length(product_description) <= 2000);
ALTER TABLE offers ADD COLUMN talking_points text CHECK (length(talking_points) <= 2000);
```

The existing `note` column can be dropped or kept as a general scope note. The brief
fields are what get passed to `create_deal`.

---

## 4. Shared Constants

### New file: `lib/deals/constants.ts`

Extracted from page files:

```ts
export const STATUS_LABELS: Record<DealStatus, string> = {
  requested:          "Awaiting response",
  accepted:           "In production",
  submitted:          "Preview submitted",
  revision_requested: "Changes requested",
  published:          "Published, awaiting approval",
  completed:          "Completed",
  cancelled:          "Cancelled",
  disputed:           "Disputed",
};

export const DEAL_STEPS = [
  "Booked", "Accepted", "Submitted", "Published", "Completed"
];

export const STATUS_TO_STEP: Record<DealStatus, number> = {
  requested: 0,
  accepted: 1,
  submitted: 2,
  revision_requested: 2,
  published: 3,
  completed: 4,
  cancelled: -1,
  disputed: -1,
};

export const ACTION_TITLES: Record<string, string> = {
  accept:           "Deal accepted",
  decline:          "Deal declined",
  submit_preview:   "Preview submitted for review",
  approve_preview:  "Preview approved -- clear to publish",
  request_revision: "Changes requested on preview",
  mark_published:   "Content is live -- verify and approve",
  approve:          "Deal approved and completed",
  cancel:           "Deal cancelled",
  dispute:          "Dispute opened",
};
```

Page files import from here instead of defining their own copies.

### Updated `lib/deals/ui-actions.ts`

```ts
const CANDIDATES: UiAction[] = [
  { action: "accept",           label: "Accept deal",         needsUrl: null,          confirm: false },
  { action: "decline",          label: "Decline",             needsUrl: null,          confirm: true },
  { action: "submit_preview",   label: "Submit preview",      needsUrl: "preview_url", confirm: false },
  { action: "approve_preview",  label: "Approve preview",     needsUrl: null,          confirm: false },
  { action: "request_revision", label: "Request changes",     needsUrl: null,          confirm: false, needsNote: true },
  { action: "mark_published",   label: "Mark as published",   needsUrl: "live_url",    confirm: false },
  { action: "approve",          label: "Approve & complete",  needsUrl: null,          confirm: false, needsPreview: true },
  { action: "cancel",           label: "Cancel deal",         needsUrl: null,          confirm: true },
  { action: "dispute",          label: "Open dispute",        needsUrl: null,          confirm: true },
];
```

Removed: `begin_production`.
Added: `approve_preview`.

`actionsFor()` gains revision-limit awareness: when `revision_count >= revision_limit`,
`request_revision` is filtered out even if the machine allows it.

### Updated `lib/deals/machine.ts`

- Remove `funded` from `DealStatus`
- Remove `in_production` from `DealStatus`
- Remove `fund`, `begin_production` from `DealAction`
- Add `approve_preview` to `DealAction`
- `approve_preview` transition: `{ from: 'submitted', action: 'approve_preview', to: 'submitted', actor: 'brand', mode: null }`
- Re-point `in_production` transitions to `accepted`
- Remove all `funded` transitions
- Remove all escrow-specific `mode: 'escrow'` transitions
- `DISPUTABLE` list: remove `in_production`, keep `accepted`

---

## 5. Revision Note Consolidation

**Current:** `performDealAction()` passes `revision_note` in the RPC payload (stored in
`deal_events.metadata`), then does a *separate* `UPDATE deals SET last_revision_note`.

**Target:** The RPC handles everything. `transition_deal` sets `last_revision_note` on
the deal row when action = `request_revision`. The server action does not do a second
write.

The system message for `request_revision` includes the note text, so the conversation
thread shows it inline.

---

## 6. Migration Plan

### Database Migrations (ordered)

1. **Add columns:** `deals.conversation_id`, `messages.kind`, `messages.deal_id_ref`
2. **Backfill:** For existing deals with messages, create/find conversations and link them
3. **Drop:** `messages.deal_id` column and mutual-exclusion constraint
4. **Update enums:** Remove `funded`, `in_production` from `deal_status`; backfill any
   existing `funded` rows to `requested`, `in_production` rows to `accepted`
5. **Update transitions:** Replace `deal_transitions` seed data with the 8-state version
6. **New RPC:** `create_deal`; refactor `accept_offer` and `accept_campaign_application` to call it
7. **Update `transition_deal`:** Handle `approve_preview` (no state change, just event + message);
   set `last_revision_note` on `request_revision`
8. **Offer schema:** Add brief fields to `offers` table

### Application Code Changes

1. `lib/deals/machine.ts` -- 8 states, new transitions
2. `lib/deals/ui-actions.ts` -- remove `begin_production`, add `approve_preview`, revision-limit filter
3. `lib/deals/constants.ts` -- new file, extracted shared constants
4. `app/deals/page.tsx` -- import constants, remove inline definitions
5. `app/deals/[id]/page.tsx` -- import constants, show conversation thread, remove pre-deal collapsed section
6. `app/deals/[id]/actions.ts` -- remove double revision-note write, add `approve_preview` to USER_ACTIONS
7. `app/deals/[id]/message-actions.ts` -- delete file
8. `app/book/[offeringId]/actions.ts` -- call `create_deal` RPC, add analytics
9. `app/inbox/actions.ts` -- `sendOffer()` gains brief fields; `respondOffer()` updated for `accept_offer` changes
10. `app/campaigns/[id]/actions.ts` -- updated for `accept_campaign_application` changes
11. `app/inbox/[id]/page.tsx` -- offer form gains brief fields (goals, product, talking points)

---

## 7. What This Doesn't Change

- **Three entry journeys** -- booking, offer, campaign all stay as distinct user flows
- **`deal_events` table** -- still the structured audit log; system messages are the human-readable mirror
- **`markPaid()`** -- brand confirms off-platform payment. No state change, just sets
  `marked_paid_at`. Stays as-is since escrow isn't live and this is the only payment gesture.
- **`PaymentMode` type** -- all transitions now use `mode: null`. The type and the `mode`
  parameter on `canTransition()` stay in the signature for forward-compatibility when
  escrow ships. Existing `payment_mode` column on deals stays (always `'off_platform'`).
- **Reviews** -- unchanged
- **Reports** -- unchanged
- **Admin dispute resolution** -- unchanged (just fewer states to deal with)
- **Notification system** -- same `notify()` calls, just consolidated
- **RLS policies on deals** -- participants-only read stays the same
