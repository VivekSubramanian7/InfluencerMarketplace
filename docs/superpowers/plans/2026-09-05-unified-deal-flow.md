# Unified Deal Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the three deal creation paths, merge messaging into one conversation thread with system messages, simplify the state machine from 10 to 8 states, and eliminate all duplicated constants/logic.

**Architecture:** A single `create_deal` RPC replaces the three bespoke deal-insertion codepaths. All messages route through conversations (no more `messages.deal_id`). Deal state changes auto-insert system messages. The TS state machine drops `funded`/`in_production`, adds `approve_preview`.

**Tech Stack:** Supabase (PostgreSQL), Next.js server actions, TypeScript, Vitest

**Spec:** `docs/superpowers/specs/2026-09-05-unified-deal-flow-design.md`

## Global Constraints

- Next migration number: `0024` (last existing is `0023`)
- All SQL RPCs use `security definer set search_path = ''`
- All transitions enforced via `deal_transitions` table + `transition_deal` RPC
- `payment_mode` column stays but all transitions use `mode: null`
- Existing RLS policies on `deals`, `messages`, `conversations` must not break
- Vitest tests live in `lib/deals/__tests__/`; run with `npx vitest run`
- Generate transitions seed via `npx tsx scripts/generate-transitions-sql.ts`

---

### Task 1: Update TypeScript State Machine & Constants

**Files:**
- Modify: `lib/deals/machine.ts`
- Create: `lib/deals/constants.ts`
- Modify: `lib/deals/ui-actions.ts`
- Modify: `lib/deals/__tests__/machine.test.ts`
- Modify: `lib/deals/__tests__/ui-actions.test.ts`
- Modify: `lib/deals/__tests__/primary-action.test.ts`

**Interfaces:**
- Produces: `DealStatus` (8-member union), `DealAction` (includes `approve_preview`, excludes `fund`/`begin_production`), `TRANSITIONS[]`, `canTransition()`
- Produces: `STATUS_LABELS`, `DEAL_STEPS`, `STATUS_TO_STEP`, `ACTION_TITLES` from `constants.ts`
- Produces: `actionsFor()` with revision-limit-aware signature: `actionsFor(status, role, mode, revisionCount?, revisionLimit?)`

- [ ] **Step 1: Update `lib/deals/machine.ts`**

Replace the entire file contents:

```ts
export type DealStatus =
  | "requested" | "accepted" | "submitted"
  | "revision_requested" | "published" | "completed" | "cancelled" | "disputed";

export type DealAction =
  | "accept" | "decline" | "expire_accept" | "submit_preview"
  | "approve_preview" | "request_revision" | "mark_published" | "approve"
  | "auto_approve" | "cancel" | "dispute" | "resolve_release" | "resolve_refund";

export type Actor = "brand" | "creator" | "system" | "admin";
export type PaymentMode = "escrow" | "off_platform";

export interface Transition {
  from: DealStatus;
  action: DealAction;
  to: DealStatus;
  actor: Actor;
  mode: PaymentMode | null;
}

const DISPUTABLE: DealStatus[] = [
  "accepted", "submitted", "revision_requested", "published",
];

export const TRANSITIONS: Transition[] = [
  // creator acceptance — no funding gate (escrow not live)
  { from: "requested", action: "accept", to: "accepted", actor: "creator", mode: null },
  { from: "requested", action: "decline", to: "cancelled", actor: "creator", mode: null },

  // 72h accept deadline (worker)
  { from: "requested", action: "expire_accept", to: "cancelled", actor: "system", mode: null },

  // production flow — creator submits directly from accepted
  { from: "accepted", action: "submit_preview", to: "submitted", actor: "creator", mode: null },
  { from: "revision_requested", action: "submit_preview", to: "submitted", actor: "creator", mode: null },
  { from: "submitted", action: "request_revision", to: "revision_requested", actor: "brand", mode: null },
  { from: "submitted", action: "approve_preview", to: "submitted", actor: "brand", mode: null },
  { from: "submitted", action: "mark_published", to: "published", actor: "creator", mode: null },

  // completion
  { from: "published", action: "approve", to: "completed", actor: "brand", mode: null },
  { from: "published", action: "auto_approve", to: "completed", actor: "system", mode: null },

  // cancellation before submission
  { from: "requested", action: "cancel", to: "cancelled", actor: "brand", mode: null },
  { from: "accepted", action: "cancel", to: "cancelled", actor: "brand", mode: null },
  { from: "accepted", action: "cancel", to: "cancelled", actor: "creator", mode: null },

  // disputes
  ...DISPUTABLE.flatMap((from): Transition[] => [
    { from, action: "dispute", to: "disputed", actor: "brand", mode: null },
    { from, action: "dispute", to: "disputed", actor: "creator", mode: null },
  ]),
  { from: "disputed", action: "resolve_release", to: "completed", actor: "admin", mode: null },
  { from: "disputed", action: "resolve_refund", to: "cancelled", actor: "admin", mode: null },
];

export function canTransition(
  from: DealStatus,
  action: DealAction,
  actor: Actor,
  mode: PaymentMode
): Transition | undefined {
  return TRANSITIONS.find(
    (t) =>
      t.from === from &&
      t.action === action &&
      t.actor === actor &&
      (t.mode === null || t.mode === mode)
  );
}
```

- [ ] **Step 2: Create `lib/deals/constants.ts`**

```ts
import type { DealStatus } from "./machine";

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
  "Booked", "Accepted", "Submitted", "Published", "Completed",
] as const;

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
  approve_preview:  "Preview approved — clear to publish",
  request_revision: "Changes requested on preview",
  mark_published:   "Content is live — verify and approve",
  approve:          "Deal approved and completed",
  cancel:           "Deal cancelled",
  dispute:          "Dispute opened",
};
```

- [ ] **Step 3: Update `lib/deals/ui-actions.ts`**

Replace the entire file:

```ts
import {
  canTransition, DealAction, DealStatus, PaymentMode,
} from "@/lib/deals/machine";

export interface UiAction {
  action: DealAction;
  label: string;
  needsUrl: "preview_url" | "live_url" | null;
  confirm: boolean;
  needsNote?: boolean;
  needsPreview?: boolean;
}

const CANDIDATES: UiAction[] = [
  { action: "accept", label: "Accept deal", needsUrl: null, confirm: false },
  { action: "decline", label: "Decline", needsUrl: null, confirm: true },
  { action: "submit_preview", label: "Submit preview", needsUrl: "preview_url", confirm: false },
  { action: "approve_preview", label: "Approve preview", needsUrl: null, confirm: false },
  { action: "request_revision", label: "Request changes", needsUrl: null, confirm: false, needsNote: true },
  { action: "mark_published", label: "Mark as published", needsUrl: "live_url", confirm: false },
  { action: "approve", label: "Approve & complete", needsUrl: null, confirm: false, needsPreview: true },
  { action: "cancel", label: "Cancel deal", needsUrl: null, confirm: true },
  { action: "dispute", label: "Open dispute", needsUrl: null, confirm: true },
];

export function actionsFor(
  status: DealStatus,
  role: "brand" | "creator",
  mode: PaymentMode,
  revisionCount = 0,
  revisionLimit = 1,
): UiAction[] {
  return CANDIDATES.filter((c) => {
    if (c.action === "request_revision" && revisionCount >= revisionLimit) return false;
    return canTransition(status, c.action, role, mode);
  });
}

export function primaryActionLabel(
  status: DealStatus,
  role: "brand" | "creator",
  mode: PaymentMode,
): string | null {
  const first = actionsFor(status, role, mode).find((a) => !a.confirm);
  return first?.label ?? null;
}
```

- [ ] **Step 4: Rewrite `lib/deals/__tests__/machine.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { canTransition, TRANSITIONS, type DealStatus } from "@/lib/deals/machine";

describe("deal state machine (8 states)", () => {
  it("creator accepts directly from requested (no funding gate)", () => {
    expect(canTransition("requested", "accept", "creator", "off_platform")).toBeTruthy();
  });

  it("fund action does not exist", () => {
    expect(canTransition("requested", "fund" as any, "system", "off_platform")).toBeUndefined();
  });

  it("actor is enforced: brand cannot accept", () => {
    expect(canTransition("requested", "accept", "brand", "off_platform")).toBeUndefined();
  });

  it("happy path: requested -> accepted -> submitted -> published -> completed", () => {
    let s: DealStatus = "requested";
    s = canTransition(s, "accept", "creator", "off_platform")!.to;
    expect(s).toBe("accepted");
    s = canTransition(s, "submit_preview", "creator", "off_platform")!.to;
    expect(s).toBe("submitted");
    s = canTransition(s, "mark_published", "creator", "off_platform")!.to;
    expect(s).toBe("published");
    s = canTransition(s, "approve", "brand", "off_platform")!.to;
    expect(s).toBe("completed");
  });

  it("approve_preview is a signal: from submitted stays submitted", () => {
    const t = canTransition("submitted", "approve_preview", "brand", "off_platform");
    expect(t).toBeTruthy();
    expect(t!.to).toBe("submitted");
  });

  it("revision loop: submitted -> revision_requested -> submitted", () => {
    expect(canTransition("submitted", "request_revision", "brand", "off_platform")!.to)
      .toBe("revision_requested");
    expect(canTransition("revision_requested", "submit_preview", "creator", "off_platform")!.to)
      .toBe("submitted");
  });

  it("timers: expire_accept cancels, auto_approve completes", () => {
    expect(canTransition("requested", "expire_accept", "system", "off_platform")!.to).toBe("cancelled");
    expect(canTransition("published", "auto_approve", "system", "off_platform")!.to).toBe("completed");
  });

  it("disputes: raisable from accepted/submitted/revision_requested/published", () => {
    expect(canTransition("accepted", "dispute", "brand", "off_platform")).toBeTruthy();
    expect(canTransition("submitted", "dispute", "creator", "off_platform")).toBeTruthy();
    expect(canTransition("disputed", "resolve_release", "admin", "off_platform")!.to).toBe("completed");
    expect(canTransition("disputed", "resolve_refund", "admin", "off_platform")!.to).toBe("cancelled");
    expect(canTransition("disputed", "resolve_release", "brand", "off_platform")).toBeUndefined();
  });

  it("terminal states have no outgoing transitions", () => {
    expect(TRANSITIONS.filter((t) => t.from === "completed" || t.from === "cancelled"))
      .toHaveLength(0);
  });

  it("brand can cancel requested and accepted, not after submission", () => {
    expect(canTransition("requested", "cancel", "brand", "off_platform")).toBeTruthy();
    expect(canTransition("accepted", "cancel", "brand", "off_platform")).toBeTruthy();
    expect(canTransition("submitted", "cancel", "brand", "off_platform")).toBeUndefined();
  });

  it("creator declines from requested", () => {
    expect(canTransition("requested", "decline", "creator", "off_platform")!.to).toBe("cancelled");
  });

  it("no in_production or funded states exist in transitions", () => {
    expect(TRANSITIONS.some((t) => t.from === "funded" as any || t.to === "funded" as any)).toBe(false);
    expect(TRANSITIONS.some((t) => t.from === "in_production" as any || t.to === "in_production" as any)).toBe(false);
  });
});
```

- [ ] **Step 5: Rewrite `lib/deals/__tests__/ui-actions.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { actionsFor } from "@/lib/deals/ui-actions";

const acts = (s: Parameters<typeof actionsFor>[0], r: "brand" | "creator",
              m: Parameters<typeof actionsFor>[2] = "off_platform",
              rc = 0, rl = 1) =>
  actionsFor(s, r, m, rc, rl).map((a) => a.action);

describe("actionsFor (8 states)", () => {
  it("creator on requested: accept or decline", () => {
    expect(acts("requested", "creator")).toEqual(["accept", "decline"]);
  });

  it("brand on requested: cancel only", () => {
    expect(acts("requested", "brand")).toEqual(["cancel"]);
  });

  it("accepted: creator submits preview or cancels; brand can cancel or dispute", () => {
    expect(acts("accepted", "creator")).toEqual(["submit_preview", "cancel", "dispute"]);
    expect(acts("accepted", "brand")).toEqual(["cancel", "dispute"]);
  });

  it("submitted: brand approves-preview or requests revision; creator publishes", () => {
    expect(acts("submitted", "brand")).toEqual(["approve_preview", "request_revision", "dispute"]);
    expect(acts("submitted", "creator")).toEqual(["mark_published", "dispute"]);
  });

  it("submitted with revisions exhausted: brand gets approve_preview only (no request_revision)", () => {
    expect(acts("submitted", "brand", "off_platform", 2, 2))
      .toEqual(["approve_preview", "dispute"]);
  });

  it("published: brand approves; creator can only dispute", () => {
    expect(acts("published", "brand")).toEqual(["approve", "dispute"]);
    expect(acts("published", "creator")).toEqual(["dispute"]);
  });

  it("terminal states expose nothing", () => {
    expect(acts("completed", "brand")).toEqual([]);
    expect(acts("cancelled", "creator")).toEqual([]);
  });

  it("deliverable actions carry their URL requirement", () => {
    const submit = actionsFor("accepted", "creator", "off_platform")
      .find((a) => a.action === "submit_preview");
    expect(submit?.needsUrl).toBe("preview_url");
    const publish = actionsFor("submitted", "creator", "off_platform")
      .find((a) => a.action === "mark_published");
    expect(publish?.needsUrl).toBe("live_url");
  });

  it("destructive actions require confirmation", () => {
    for (const a of actionsFor("accepted", "brand", "off_platform")) {
      if (a.action === "cancel" || a.action === "dispute") expect(a.confirm).toBe(true);
    }
  });

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
});
```

- [ ] **Step 6: Rewrite `lib/deals/__tests__/primary-action.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { primaryActionLabel } from "@/lib/deals/ui-actions";

describe("primaryActionLabel (8 states)", () => {
  it("creator on requested: Accept deal", () => {
    expect(primaryActionLabel("requested", "creator", "off_platform")).toBe("Accept deal");
  });

  it("creator on accepted: Submit preview (no more Start production)", () => {
    expect(primaryActionLabel("accepted", "creator", "off_platform")).toBe("Submit preview");
  });

  it("brand on submitted: Approve preview", () => {
    expect(primaryActionLabel("submitted", "brand", "off_platform")).toBe("Approve preview");
  });

  it("brand on published: Approve & complete", () => {
    expect(primaryActionLabel("published", "brand", "off_platform")).toBe("Approve & complete");
  });

  it("terminal states return null", () => {
    expect(primaryActionLabel("completed", "brand", "off_platform")).toBeNull();
    expect(primaryActionLabel("cancelled", "creator", "off_platform")).toBeNull();
  });

  it("disputed returns null", () => {
    expect(primaryActionLabel("disputed", "brand", "off_platform")).toBeNull();
  });
});
```

- [ ] **Step 7: Run tests**

Run: `npx vitest run`
Expected: all tests pass

- [ ] **Step 8: Regenerate transitions seed SQL**

Run: `npx tsx scripts/generate-transitions-sql.ts`
Verify output file `supabase/migrations/0005_transitions_seed.sql` reflects the 8-state transitions. This file is for reference — we'll write a new migration that re-seeds.

- [ ] **Step 9: Commit**

```bash
git add lib/deals/machine.ts lib/deals/constants.ts lib/deals/ui-actions.ts lib/deals/__tests__/ supabase/migrations/0005_transitions_seed.sql
git commit -m "feat: simplify deal state machine to 8 states, extract shared constants

Drop funded and in_production states. Add approve_preview signal action.
Extract STATUS_LABELS, DEAL_STEPS, STATUS_TO_STEP, ACTION_TITLES to
lib/deals/constants.ts. actionsFor() now accepts revision count/limit
to hide request_revision when exhausted.

Co-Authored-By: Claude Opus 4 <noreply@anthropic.com>"
```

---

### Task 2: Database Migration — Schema Changes & State Backfill

**Files:**
- Create: `supabase/migrations/0024_unified_deal_flow.sql`

**Interfaces:**
- Consumes: existing `deals`, `messages`, `conversations`, `offers`, `deal_transitions`, `deal_events` tables
- Produces: `deals.conversation_id` column, `messages.kind` column, `messages.deal_id_ref` column, `messages.sender_id` nullable, `offers` brief fields, updated `deal_status` enum (without `funded`/`in_production`), re-seeded `deal_transitions`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0024_unified_deal_flow.sql`:

```sql
-- Unified deal flow: 8-state machine, conversation-linked messaging,
-- system messages, offer brief fields, create_deal RPC.

-- ============================================================
-- 1. Backfill existing deals out of removed states
-- ============================================================
update public.deals set status = 'requested' where status = 'funded';
update public.deals set status = 'accepted' where status = 'in_production';

-- 2. Add conversation_id to deals
-- ============================================================
alter table public.deals
  add column conversation_id uuid references public.conversations(id);

-- Backfill: for every deal, find or create the conversation
do $$
declare
  r record;
  v_conv_id uuid;
begin
  for r in
    select d.id as deal_id, d.brand_id, d.creator_id
    from public.deals d
    where d.conversation_id is null
  loop
    select id into v_conv_id
    from public.conversations c
    where c.brand_id = r.brand_id and c.creator_id = r.creator_id;

    if v_conv_id is null then
      perform set_config('clipline.internal', '1', true);
      insert into public.conversations (brand_id, creator_id, status, invite_message, responded_at)
      values (r.brand_id, r.creator_id, 'accepted', 'Conversation created for existing deal.', now())
      returning id into v_conv_id;
      perform set_config('clipline.internal', '', true);
    end if;

    update public.deals set conversation_id = v_conv_id where id = r.deal_id;
  end loop;
end;
$$;

-- 3. Messages: add kind, deal_id_ref, make sender_id nullable
-- ============================================================
alter table public.messages
  add column kind text not null default 'message'
    check (kind in ('message', 'system')),
  add column deal_id_ref uuid references public.deals(id);

alter table public.messages
  alter column sender_id drop not null;

-- Backfill: move deal messages to conversations
do $$
declare
  r record;
  v_conv_id uuid;
begin
  for r in
    select m.id as msg_id, m.deal_id, d.brand_id, d.creator_id
    from public.messages m
    join public.deals d on d.id = m.deal_id
    where m.deal_id is not null and m.conversation_id is null
  loop
    select id into v_conv_id
    from public.conversations c
    where c.brand_id = r.brand_id and c.creator_id = r.creator_id;

    if v_conv_id is null then
      perform set_config('clipline.internal', '1', true);
      insert into public.conversations (brand_id, creator_id, status, invite_message, responded_at)
      values (r.brand_id, r.creator_id, 'accepted', 'Conversation created for message migration.', now())
      returning id into v_conv_id;
      perform set_config('clipline.internal', '', true);
    end if;

    update public.messages
    set conversation_id = v_conv_id, deal_id_ref = r.deal_id
    where id = r.msg_id;
  end loop;
end;
$$;

-- Drop old constraint and column
alter table public.messages drop constraint if exists messages_one_parent;
alter table public.messages drop column if exists deal_id;

-- Update RLS: deal participants can read messages via conversation
-- (existing conversation participant policies already cover this since
-- messages now all route through conversation_id)

-- 4. Offer brief fields
-- ============================================================
alter table public.offers
  add column goals text check (length(goals) between 1 and 2000),
  add column product_description text check (length(product_description) <= 2000),
  add column talking_points text check (length(talking_points) <= 2000);

-- Copy existing note into goals for any offers that had a note
update public.offers set goals = note where note is not null and goals is null;

-- 5. Re-seed deal_transitions for 8-state machine
-- ============================================================
truncate table public.deal_transitions;
insert into public.deal_transitions (from_status, action, to_status, actor_role, mode) values
  ('requested', 'accept', 'accepted', 'creator', null),
  ('requested', 'decline', 'cancelled', 'creator', null),
  ('requested', 'expire_accept', 'cancelled', 'system', null),
  ('requested', 'cancel', 'cancelled', 'brand', null),
  ('accepted', 'submit_preview', 'submitted', 'creator', null),
  ('accepted', 'cancel', 'cancelled', 'brand', null),
  ('accepted', 'cancel', 'cancelled', 'creator', null),
  ('submitted', 'request_revision', 'revision_requested', 'brand', null),
  ('submitted', 'approve_preview', 'submitted', 'brand', null),
  ('submitted', 'mark_published', 'published', 'creator', null),
  ('revision_requested', 'submit_preview', 'submitted', 'creator', null),
  ('published', 'approve', 'completed', 'brand', null),
  ('published', 'auto_approve', 'completed', 'system', null),
  ('accepted', 'dispute', 'disputed', 'brand', null),
  ('accepted', 'dispute', 'disputed', 'creator', null),
  ('submitted', 'dispute', 'disputed', 'brand', null),
  ('submitted', 'dispute', 'disputed', 'creator', null),
  ('revision_requested', 'dispute', 'disputed', 'brand', null),
  ('revision_requested', 'dispute', 'disputed', 'creator', null),
  ('published', 'dispute', 'disputed', 'brand', null),
  ('published', 'dispute', 'disputed', 'creator', null),
  ('disputed', 'resolve_release', 'completed', 'admin', null),
  ('disputed', 'resolve_refund', 'cancelled', 'admin', null);

-- 6. Update transition_deal RPC: system messages, approve_preview,
--    last_revision_note in RPC, remove funded_at timestamp
-- ============================================================
drop function if exists public.transition_deal(uuid, text, text, jsonb);

create function public.transition_deal(
  p_deal_id uuid,
  p_action text,
  p_actor_role text,
  p_payload jsonb default '{}'
) returns public.deals
language plpgsql security definer set search_path = ''
as $$
declare
  v_deal public.deals;
  v_transition public.deal_transitions;
  v_uid uuid := auth.uid();
  v_preview text := nullif(p_payload->>'preview_url', '');
  v_live text := nullif(p_payload->>'live_url', '');
  v_note text := nullif(p_payload->>'revision_note', '');
  v_sys_msg text;
begin
  select * into v_deal from public.deals where id = p_deal_id for update;
  if not found then raise exception 'deal not found'; end if;

  if p_actor_role = 'brand' and v_deal.brand_id is distinct from v_uid then
    raise exception 'not the brand on this deal';
  elsif p_actor_role = 'creator' and v_deal.creator_id is distinct from v_uid then
    raise exception 'not the creator on this deal';
  elsif p_actor_role = 'admin' and not exists (
    select 1 from public.profiles where id = v_uid and role = 'admin') then
    raise exception 'not an admin';
  elsif p_actor_role = 'system' and v_uid is not null then
    raise exception 'system transitions only from service role';
  end if;

  select * into v_transition from public.deal_transitions t
  where t.from_status = v_deal.status
    and t.action = p_action
    and t.actor_role = p_actor_role
    and (t.mode is null or t.mode = v_deal.payment_mode);
  if not found then
    raise exception 'illegal transition: % via % as % (mode %)',
      v_deal.status, p_action, p_actor_role, v_deal.payment_mode;
  end if;

  if p_action = 'request_revision' and v_deal.revision_count >= v_deal.revision_limit then
    raise exception 'revision limit reached';
  end if;

  if p_action = 'submit_preview' then
    if v_preview is null or v_preview !~* '^https?://' then
      raise exception 'submit_preview requires an http(s) preview_url';
    end if;
  end if;
  if p_action = 'mark_published' then
    if v_live is null or v_live !~* '^https?://' then
      raise exception 'mark_published requires an http(s) live_url';
    end if;
  end if;

  update public.deals set
    status = v_transition.to_status,
    revision_count = revision_count
      + (case when p_action = 'request_revision' then 1 else 0 end),
    preview_url = case when p_action = 'submit_preview' then v_preview else preview_url end,
    live_url = case when p_action = 'mark_published' then v_live else live_url end,
    last_revision_note = case when p_action = 'request_revision' then v_note else last_revision_note end,
    accepted_at  = case when v_transition.to_status = 'accepted'  then now() else accepted_at end,
    submitted_at = case when v_transition.to_status = 'submitted' then now() else submitted_at end,
    published_at = case when v_transition.to_status = 'published' then now() else published_at end,
    completed_at = case when v_transition.to_status = 'completed' then now() else completed_at end,
    cancelled_at = case when v_transition.to_status = 'cancelled' then now() else cancelled_at end
  where id = p_deal_id
  returning * into v_deal;

  insert into public.deal_events (deal_id, actor, action, from_status, to_status, metadata)
  values (p_deal_id, v_uid, p_action, v_transition.from_status, v_transition.to_status,
          coalesce(p_payload, '{}'::jsonb));

  -- System message in the conversation thread
  if v_deal.conversation_id is not null then
    v_sys_msg := case p_action
      when 'accept' then 'Creator accepted the deal'
      when 'decline' then 'Creator declined the deal'
      when 'submit_preview' then 'Preview submitted: ' || coalesce(v_preview, '')
      when 'approve_preview' then 'Brand approved the preview — clear to publish'
      when 'request_revision' then 'Brand requested changes: ' || coalesce(v_note, '(no note)')
      when 'mark_published' then 'Content published: ' || coalesce(v_live, '')
      when 'approve' then 'Brand approved — deal complete'
      when 'auto_approve' then 'Auto-approved after 5 days'
      when 'cancel' then p_actor_role || ' cancelled the deal'
      when 'dispute' then p_actor_role || ' opened a dispute'
      when 'expire_accept' then 'Deal expired (no response in 72h)'
      when 'resolve_release' then 'Dispute resolved — deal completed'
      when 'resolve_refund' then 'Dispute resolved — deal refunded'
      else p_action
    end;

    insert into public.messages (conversation_id, sender_id, body, kind, deal_id_ref)
    values (v_deal.conversation_id, null, v_sys_msg, 'system', v_deal.id);
  end if;

  return v_deal;
end;
$$;

revoke all on function public.transition_deal(uuid, text, text, jsonb) from public;
grant execute on function public.transition_deal(uuid, text, text, jsonb)
  to authenticated, service_role;

-- 7. Update mark_deal_paid: remove in_production from payable states
-- ============================================================
drop function if exists public.mark_deal_paid(uuid);

create function public.mark_deal_paid(p_deal_id uuid) returns public.deals
language plpgsql security definer set search_path = ''
as $$
declare
  v_deal public.deals;
  v_uid uuid := auth.uid();
begin
  select * into v_deal from public.deals where id = p_deal_id for update;
  if not found then raise exception 'deal not found'; end if;
  if v_deal.brand_id is distinct from v_uid then
    raise exception 'only the brand can mark a deal paid';
  end if;
  if v_deal.payment_mode <> 'off_platform' then
    raise exception 'mark-paid applies only to off-platform deals';
  end if;
  if v_deal.status not in ('accepted','submitted',
                           'revision_requested','published','completed') then
    raise exception 'deal is not in a payable state';
  end if;
  if v_deal.marked_paid_at is not null then
    raise exception 'deal already marked paid';
  end if;

  update public.deals set marked_paid_at = now()
  where id = p_deal_id
  returning * into v_deal;

  insert into public.deal_events (deal_id, actor, action, from_status, to_status)
  values (p_deal_id, v_uid, 'mark_paid', v_deal.status, v_deal.status);

  return v_deal;
end;
$$;

revoke all on function public.mark_deal_paid(uuid) from public;
grant execute on function public.mark_deal_paid(uuid) to authenticated;

-- 8. Update deal timers: remove 'funded' from expire query
-- ============================================================
create or replace function public.run_deal_timers() returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select id from public.deals
    where status = 'requested'
      and requested_at < now() - interval '72 hours'
  loop
    begin
      perform public.transition_deal(r.id, 'expire_accept', 'system');
      n := n + 1;
    exception when others then
      null;
    end;
  end loop;

  for r in
    select id from public.deals
    where status = 'published'
      and published_at < now() - interval '5 days'
  loop
    begin
      perform public.transition_deal(r.id, 'auto_approve', 'system');
      n := n + 1;
    exception when others then
      null;
    end;
  end loop;

  return n;
end;
$$;

-- 9. create_deal RPC
-- ============================================================
create function public.create_deal(
  p_brand_id uuid,
  p_creator_id uuid,
  p_offering_id uuid,
  p_price_cents bigint,
  p_brief jsonb,
  p_source text,
  p_source_meta jsonb default '{}',
  p_initial_status text default 'requested'
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_offering public.offerings;
  v_deal_id uuid;
  v_conv_id uuid;
  v_product_desc text;
  v_sys_msg text;
begin
  if p_initial_status not in ('requested', 'accepted') then
    raise exception 'initial status must be requested or accepted';
  end if;

  select * into v_offering from public.offerings o
  where o.id = p_offering_id;
  if not found or not v_offering.active then
    raise exception 'offering not found or inactive';
  end if;

  -- auto-fill product description from brand's products if not provided
  if p_brief->>'product_description' is null or p_brief->>'product_description' = '' then
    select string_agg(bp.name, ', ' order by bp.name)
    into v_product_desc
    from public.brand_products bp
    where bp.brand_id = p_brand_id;
  end if;

  insert into public.deals
    (brand_id, creator_id, offering_id, offering_type, offering_title,
     price_cents, currency, revision_limit, payment_mode, status,
     accepted_at)
  values
    (p_brand_id, p_creator_id, v_offering.id, v_offering.type,
     v_offering.title, p_price_cents, v_offering.currency,
     v_offering.revision_limit, 'off_platform',
     p_initial_status::public.deal_status,
     case when p_initial_status = 'accepted' then now() else null end)
  returning id into v_deal_id;

  insert into public.briefs (deal_id, goals, product_description, talking_points)
  values (
    v_deal_id,
    p_brief->>'goals',
    coalesce(nullif(p_brief->>'product_description', ''), v_product_desc),
    nullif(p_brief->>'talking_points', '')
  );

  -- find or create conversation
  select id into v_conv_id
  from public.conversations c
  where c.brand_id = p_brand_id and c.creator_id = p_creator_id;

  if v_conv_id is null then
    perform set_config('clipline.internal', '1', true);
    insert into public.conversations (brand_id, creator_id, status, invite_message, responded_at)
    values (p_brand_id, p_creator_id, 'accepted',
            left(coalesce(p_brief->>'goals', 'New deal'), 2000), now())
    returning id into v_conv_id;
    perform set_config('clipline.internal', '', true);
  end if;

  update public.deals set conversation_id = v_conv_id where id = v_deal_id;

  insert into public.deal_events (deal_id, actor, action, metadata)
  values (v_deal_id, auth.uid(), 'deal_created',
          p_source_meta || jsonb_build_object('source', p_source));

  v_sys_msg := case p_initial_status
    when 'accepted' then 'Deal started: ' || v_offering.title
    else 'New booking request: ' || v_offering.title
  end;
  insert into public.messages (conversation_id, sender_id, body, kind, deal_id_ref)
  values (v_conv_id, null, v_sys_msg, 'system', v_deal_id);

  return v_deal_id;
end;
$$;

revoke all on function public.create_deal(uuid,uuid,uuid,bigint,jsonb,text,jsonb,text) from public;
grant execute on function public.create_deal(uuid,uuid,uuid,bigint,jsonb,text,jsonb,text)
  to authenticated, service_role;

-- 10. Refactor accept_offer to use create_deal
-- ============================================================
create or replace function public.accept_offer(p_offer_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_offer public.offers;
  v_conv public.conversations;
  v_offering public.offerings;
  v_deal_id uuid;
  v_brief jsonb;
begin
  select * into v_offer from public.offers o where o.id = p_offer_id for update;
  if not found then raise exception 'Offer not found'; end if;
  select * into v_conv from public.conversations c where c.id = v_offer.conversation_id;
  if v_uid is distinct from v_conv.creator_id then
    raise exception 'Only the creator can accept an offer';
  end if;
  if v_offer.status <> 'pending' then
    raise exception 'This offer has already been answered';
  end if;
  select * into v_offering from public.offerings o where o.id = v_offer.offering_id;
  if not found or not v_offering.active then
    raise exception 'That offering is no longer available';
  end if;

  v_brief := jsonb_build_object(
    'goals', coalesce(v_offer.goals, v_offer.note, 'Agreed in conversation — see the thread.'),
    'product_description', coalesce(v_offer.product_description, ''),
    'talking_points', coalesce(v_offer.talking_points, '')
  );

  v_deal_id := public.create_deal(
    v_conv.brand_id, v_conv.creator_id, v_offering.id,
    v_offer.price_cents, v_brief, 'offer',
    jsonb_build_object(
      'offer_id', v_offer.id,
      'conversation_id', v_conv.id,
      'listed_price_cents', v_offering.price_cents,
      'agreed_price_cents', v_offer.price_cents),
    'accepted'
  );

  perform set_config('clipline.internal', '1', true);
  update public.offers
  set status = 'accepted', decided_at = now(), deal_id = v_deal_id
  where id = p_offer_id;
  perform set_config('clipline.internal', '', true);

  return v_deal_id;
end;
$$;

-- 11. Refactor accept_campaign_application to use create_deal
-- ============================================================
create or replace function public.accept_campaign_application(p_application_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_app public.campaign_applications;
  v_campaign public.campaigns;
  v_offering public.offerings;
  v_deal_id uuid;
  v_brief jsonb;
begin
  select * into v_app from public.campaign_applications a
  where a.id = p_application_id for update;
  if not found then raise exception 'Application not found'; end if;
  select * into v_campaign from public.campaigns c where c.id = v_app.campaign_id;
  if v_uid is distinct from v_campaign.brand_id then
    raise exception 'Only the campaign brand can accept applications';
  end if;
  if v_app.status <> 'pending' then
    raise exception 'Only pending applications can be accepted';
  end if;

  select * into v_offering from public.offerings o
  where o.creator_id = v_app.creator_id
    and o.type = v_campaign.offering_type
    and o.active
  order by o.price_cents asc
  limit 1;
  if not found then
    raise exception 'This creator has no active % offering',
      v_campaign.offering_type;
  end if;

  v_brief := jsonb_build_object(
    'goals', v_campaign.title || E'\n\n' || v_campaign.description,
    'talking_points', v_app.pitch
  );

  v_deal_id := public.create_deal(
    v_campaign.brand_id, v_app.creator_id, v_offering.id,
    v_app.proposed_price_cents, v_brief, 'campaign',
    jsonb_build_object(
      'campaign_id', v_campaign.id,
      'application_id', v_app.id,
      'listed_price_cents', v_offering.price_cents,
      'agreed_price_cents', v_app.proposed_price_cents),
    'accepted'
  );

  update public.campaign_applications
  set status = 'accepted', deal_id = v_deal_id
  where id = p_application_id;

  return v_deal_id;
end;
$$;

-- 12. RLS policy for system messages (sender_id is null)
-- ============================================================
create policy "system messages readable by conversation participants"
  on public.messages for select
  using (
    sender_id is null
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (select auth.uid()) in (c.brand_id, c.creator_id)
    )
  );
```

- [ ] **Step 2: Verify migration syntax**

Read through the file for SQL syntax errors. Ensure all `create or replace function` and `drop function if exists` are matched correctly.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0024_unified_deal_flow.sql
git commit -m "feat: database migration for unified deal flow

Backfill funded->requested and in_production->accepted. Add
deals.conversation_id, messages.kind/deal_id_ref, offer brief fields.
Re-seed deal_transitions for 8 states. Rewrite transition_deal with
system messages and last_revision_note. Add create_deal RPC. Refactor
accept_offer and accept_campaign_application to use create_deal.

Co-Authored-By: Claude Opus 4 <noreply@anthropic.com>"
```

---

### Task 3: Update Server Actions — Deal Actions, Booking, Inbox Offers

**Files:**
- Modify: `app/deals/[id]/actions.ts`
- Modify: `app/book/[offeringId]/actions.ts`
- Modify: `app/inbox/actions.ts`
- Delete: `app/deals/[id]/message-actions.ts`

**Interfaces:**
- Consumes: `create_deal` RPC (from Task 2), `transition_deal` RPC (updated in Task 2), `ACTION_TITLES` from `lib/deals/constants.ts` (from Task 1)
- Produces: updated `performDealAction()`, updated `createBooking()`, updated `sendOffer()`, updated `respondOffer()`

- [ ] **Step 1: Update `app/deals/[id]/actions.ts`**

Changes:
1. Import `ACTION_TITLES` from `lib/deals/constants` instead of defining inline
2. Add `approve_preview` to `USER_ACTIONS`
3. Remove `begin_production` from `USER_ACTIONS`
4. Remove the double-write of `last_revision_note` (lines 69-74)
5. Remove `in_production` references from `markPaid` payable states

```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseMediaUrl, parseText } from "@/lib/storefront/validation";
import { notify } from "@/lib/notify";
import { friendlyDbError } from "@/lib/errors";
import { trackServerEvent } from "@/lib/analytics";
import { ACTION_TITLES } from "@/lib/deals/constants";

const USER_ACTIONS = new Set([
  "accept", "decline", "submit_preview", "approve_preview",
  "request_revision", "mark_published", "approve", "cancel", "dispute",
]);

export async function performDealAction(formData: FormData) {
  const { role } = await requireUser();
  const supabase = await createServerSupabase();
  const dealId = String(formData.get("deal_id") ?? "");
  const action = String(formData.get("action") ?? "");
  const rawUrl = String(formData.get("url") ?? "");

  if (!USER_ACTIONS.has(action) || (role !== "brand" && role !== "creator")) {
    redirect(`/deals/${dealId}?error=` + encodeURIComponent("Unknown action"));
  }

  const payload: Record<string, string> = {};
  if (action === "submit_preview" || action === "mark_published") {
    const url = parseMediaUrl(rawUrl);
    if (!url) {
      redirect(`/deals/${dealId}?error=` +
        encodeURIComponent("A valid http(s) link is required for this step"));
    }
    payload[action === "submit_preview" ? "preview_url" : "live_url"] = url;
  }
  if (action === "request_revision") {
    const note = parseText(String(formData.get("note") ?? ""), 2000);
    if (!note) {
      redirect(`/deals/${dealId}?error=` + encodeURIComponent("Say what to change (max 2000 characters)"));
    }
    payload.revision_note = note;
  }

  const t0 = Date.now();
  const { data: deal, error } = await supabase.rpc("transition_deal", {
    p_deal_id: dealId,
    p_action: action,
    p_actor_role: role,
    p_payload: payload,
  });
  const duration_ms = Date.now() - t0;
  if (error) {
    redirect(`/deals/${dealId}?error=` + encodeURIComponent(friendlyDbError(error)));
  }

  if (deal) {
    await notify({
      userId: role === "brand" ? deal.creator_id : deal.brand_id,
      kind: "deal",
      title: `${ACTION_TITLES[action] ?? "Deal updated"} · ${deal.offering_title}`,
      href: `/deals/${dealId}`,
      email: true,
    });
    trackServerEvent("deal_state_changed", role === "brand" ? deal.brand_id : deal.creator_id, {
      deal_id: dealId,
      action,
      actor_role: role,
      offering_title: deal.offering_title,
      duration_ms,
    });
  }

  revalidatePath(`/deals/${dealId}`);
  redirect(`/deals/${dealId}`);
}

export async function markPaid(formData: FormData) {
  const { user } = await requireUser();
  const supabase = await createServerSupabase();
  const dealId = String(formData.get("deal_id") ?? "");

  const { error } = await supabase.rpc("mark_deal_paid", { p_deal_id: dealId });
  if (error) {
    redirect(`/deals/${dealId}?error=` + encodeURIComponent(friendlyDbError(error)));
  }
  trackServerEvent("deal_marked_paid", user.id, { deal_id: dealId });
  revalidatePath(`/deals/${dealId}`);
  redirect(`/deals/${dealId}`);
}
```

- [ ] **Step 2: Update `app/book/[offeringId]/actions.ts`**

Replace to use `create_deal` RPC and add analytics:

```ts
"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseOptionalText, parseText } from "@/lib/storefront/validation";
import { notify } from "@/lib/notify";
import { friendlyDbError } from "@/lib/errors";
import { trackServerEvent } from "@/lib/analytics";

export async function createBooking(formData: FormData) {
  const { user } = await requireRole("brand");
  const supabase = await createServerSupabase();
  const offeringId = String(formData.get("offering_id") ?? "");

  const goals = parseText(String(formData.get("goals") ?? ""), 2000);
  if (!goals) {
    redirect(`/book/${offeringId}?error=` +
      encodeURIComponent("Tell the creator what success looks like (max 2000 characters)"));
  }
  const product = parseOptionalText(String(formData.get("product_description") ?? ""), 2000);
  const talking = parseOptionalText(String(formData.get("talking_points") ?? ""), 2000);
  if (!product.ok || !talking.ok) {
    redirect(`/book/${offeringId}?error=` +
      encodeURIComponent("Product description and talking points are limited to 2000 characters"));
  }

  const { data: offering, error: oErr } = await supabase
    .from("offerings")
    .select("id, creator_id, type, title, price_cents, currency, revision_limit, active")
    .eq("id", offeringId)
    .maybeSingle();
  if (oErr || !offering || !offering.active) {
    redirect(`/discover?error=` + encodeURIComponent("That offering is no longer available"));
  }

  const { data: dealId, error: dErr } = await supabase.rpc("create_deal", {
    p_brand_id: user.id,
    p_creator_id: offering.creator_id,
    p_offering_id: offering.id,
    p_price_cents: offering.price_cents,
    p_brief: { goals, product_description: product.value, talking_points: talking.value },
    p_source: "booking",
    p_source_meta: {},
    p_initial_status: "requested",
  });
  if (dErr || !dealId) {
    const msg = friendlyDbError(dErr, {
      "42501": "You can only book as a brand account",
    });
    redirect(`/book/${offeringId}?error=` + encodeURIComponent(msg));
  }

  await notify({
    userId: offering.creator_id,
    kind: "booking",
    title: `New booking request: ${offering.title}`,
    href: `/deals/${dealId}`,
    email: true,
  });
  trackServerEvent("deal_created", user.id, {
    deal_id: dealId,
    source: "booking",
    offering_title: offering.title,
    price_cents: offering.price_cents,
  });

  redirect(`/deals/${dealId}`);
}
```

- [ ] **Step 3: Update `app/inbox/actions.ts` — `sendOffer()` gains brief fields**

In `sendOffer()`, replace the `note` field with `goals` (required), `product_description` (optional), `talking_points` (optional):

Change the validation and insert section. Replace lines 104-147 (the `sendOffer` function) with:

```ts
export async function sendOffer(formData: FormData) {
  const { user } = await requireRole("brand");
  const supabase = await createServerSupabase();
  const conversationId = String(formData.get("conversation_id") ?? "");
  const offeringId = String(formData.get("offering_id") ?? "");
  const price = parsePriceCents(String(formData.get("price") ?? ""));
  const goals = parseText(String(formData.get("goals") ?? ""), 2000);
  const product = parseOptionalText(String(formData.get("product_description") ?? ""), 2000);
  const talking = parseOptionalText(String(formData.get("talking_points") ?? ""), 2000);
  if (!offeringId || !price || !goals || !product.ok || !talking.ok) {
    redirect(`/inbox/${conversationId}?error=` +
      encodeURIComponent("Pick an offering, set a price ($1-$1M), and describe the goals (max 2000 chars each)"));
  }
  const { error } = await supabase.from("offers").insert({
    conversation_id: conversationId,
    offering_id: offeringId,
    price_cents: price,
    goals,
    product_description: product.value,
    talking_points: talking.value,
  });
  if (error) {
    const msg = friendlyDbError(error, {
      "23505": "You already have a pending offer in this conversation",
    });
    redirect(`/inbox/${conversationId}?error=` + encodeURIComponent(msg));
  }

  trackServerEvent("offer_sent", user.id, {
    conversation_id: conversationId,
    price_cents: price,
  });

  const { data: conv } = await supabase
    .from("conversations").select("creator_id").eq("id", conversationId).maybeSingle();
  if (conv) {
    await notify({
      userId: conv.creator_id,
      kind: "offer",
      title: `You have an offer: $${(price! / 100).toFixed(2)}`,
      href: `/inbox/${conversationId}`,
      email: true,
    });
  }

  revalidatePath(`/inbox/${conversationId}`);
  redirect(`/inbox/${conversationId}?saved=1`);
}
```

- [ ] **Step 4: Update `respondOffer()` in `app/inbox/actions.ts`**

The `accept_offer` RPC now creates deals at `accepted` status. Add `deal_created` tracking. The existing code already does this — just verify `trackServerEvent("deal_created", ...)` includes `source: "offer"`:

In the `response === "accepted"` branch (around line 167-173), ensure the tracking call is:

```ts
    trackServerEvent("deal_created", user.id, {
      deal_id: dealId,
      source: "offer",
      offer_id: offerId,
      conversation_id: conversationId,
    });
```

This is already present in the existing code — no change needed.

- [ ] **Step 5: Delete `app/deals/[id]/message-actions.ts`**

Delete the file. All messaging now goes through `sendThreadMessage` in `app/inbox/actions.ts`.

- [ ] **Step 6: Commit**

```bash
git add app/deals/[id]/actions.ts app/book/[offeringId]/actions.ts app/inbox/actions.ts
git rm app/deals/[id]/message-actions.ts
git commit -m "feat: unified server actions — create_deal RPC, brief fields on offers, drop deal message-actions

createBooking uses create_deal RPC. sendOffer accepts goals/product/talking
points instead of note. performDealAction imports ACTION_TITLES from constants,
removes double revision-note write, adds approve_preview. Delete
message-actions.ts (all messaging through sendThreadMessage).

Co-Authored-By: Claude Opus 4 <noreply@anthropic.com>"
```

---

### Task 4: Update Deal Pages — Constants, Conversation Thread, Progress Bar

**Files:**
- Modify: `app/deals/page.tsx`
- Modify: `app/deals/[id]/page.tsx`
- Modify: `app/deals/[id]/messages.tsx`

**Interfaces:**
- Consumes: `STATUS_LABELS`, `DEAL_STEPS`, `STATUS_TO_STEP`, `ACTION_TITLES` from `lib/deals/constants.ts` (Task 1), `actionsFor()` with revision params (Task 1), `sendThreadMessage` from `app/inbox/actions.ts` (Task 3)
- Produces: updated deal list page, updated deal detail page with conversation thread

- [ ] **Step 1: Update `app/deals/page.tsx`**

Replace the inline `STATUS_LABELS` with an import. Remove `funded`/`in_production` references:

At top, replace:
```ts
const STATUS_LABELS: Record<string, string> = {
  requested: "Awaiting creator", funded: "Funded",
  accepted: "Accepted", in_production: "In production",
  submitted: "Preview submitted", revision_requested: "Changes requested",
  published: "Published, awaiting approval", completed: "Completed",
  cancelled: "Cancelled", disputed: "Disputed",
};
```

With:
```ts
import { STATUS_LABELS } from "@/lib/deals/constants";
```

- [ ] **Step 2: Update `app/deals/[id]/page.tsx`**

Major changes:
1. Import `STATUS_LABELS`, `DEAL_STEPS`, `STATUS_TO_STEP` from `lib/deals/constants`
2. Remove inline `STATUS_LABELS`, `DEAL_STEPS`, `STATUS_TO_STEP` definitions
3. Remove the `conversationMessages` block (the pre-deal discussion section) — replaced by unified thread
4. Remove the `<DealMessages>` component import and usage — replaced by conversation thread
5. Update `actionsFor()` call to pass `revision_count` and `revision_limit`
6. Rewrite the messages section to fetch from `conversation_id` and render system messages inline
7. Remove `in_production` from `markPaid` payable states list
8. Update the import from `message-actions` to `sendThreadMessage`

The key changes in the data fetching section — replace the `conversationMessages` block and DealMessages with a conversation thread fetch:

After the existing `Promise.all` for brief/events/counterpart/review/handle, add:

```ts
  const { data: threadMessages } = deal.conversation_id
    ? await supabase
        .from("messages")
        .select("id, sender_id, body, kind, created_at")
        .eq("conversation_id", deal.conversation_id)
        .order("created_at")
    : { data: null };
```

Remove the entire `conversationMessages` block (lines 51-71).

Replace the `<DealMessages>` usage and the pre-deal `<details>` section with a unified thread that shows both user messages and system messages:

```tsx
      <section className="mt-6 rounded-xl border p-5">
        <h2 className="text-base font-bold">Messages</h2>
        <ul className="mt-3 mb-4 flex flex-col gap-2">
          {(threadMessages ?? []).map((m) => (
            m.kind === "system" ? (
              <li key={m.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                {m.body}
                <span className="h-px flex-1 bg-border" />
              </li>
            ) : (
              <li key={m.id}
                className={`max-w-[85%] rounded-lg p-3 text-sm ${
                  m.sender_id === user.id ? "self-end bg-primary text-primary-foreground" : "self-start bg-secondary"
                }`}>
                <p className="whitespace-pre-line break-words">{m.body}</p>
                <p className={`mt-1 text-xs ${m.sender_id === user.id ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {new Date(m.created_at).toLocaleString()}
                </p>
              </li>
            )
          ))}
          {(threadMessages ?? []).length === 0 && (
            <li className="text-sm text-muted-foreground">No messages yet. Say hello!</li>
          )}
        </ul>
        {deal.conversation_id && (
          <form action={sendThreadMessage} className="flex gap-2">
            <input type="hidden" name="conversation_id" value={deal.conversation_id} />
            <Input
              name="body"
              placeholder="Write a message"
              aria-label="Write a message"
              required
              maxLength={5000}
              className="flex-1"
            />
            <Button type="submit">Send</Button>
          </form>
        )}
      </section>
```

Import `sendThreadMessage` from `@/app/inbox/actions` instead of `sendMessage` from `./message-actions`.

Update the DEAL_STEPS and STATUS_TO_STEP: remove inline definitions, use imports:
```ts
import { STATUS_LABELS, DEAL_STEPS, STATUS_TO_STEP } from "@/lib/deals/constants";
```

Update `actionsFor` call to pass revision counts:
```ts
  const actions = role === "admin" ? [] :
    actionsFor(deal.status as DealStatus, myRole, deal.payment_mode as PaymentMode,
               deal.revision_count, deal.revision_limit);
```

Update `markPaid` payable states — remove `in_production`:
```ts
        ["accepted", "submitted", "revision_requested", "published", "completed"]
```

- [ ] **Step 3: Delete or simplify `app/deals/[id]/messages.tsx`**

This component is no longer needed — its functionality is inlined in the page above. Delete it.

- [ ] **Step 4: Run dev server and verify**

Run: `npx next dev`
Navigate to `/deals` and `/deals/[id]` — verify pages render without errors.

- [ ] **Step 5: Commit**

```bash
git add app/deals/page.tsx app/deals/[id]/page.tsx
git rm app/deals/[id]/messages.tsx
git commit -m "feat: deal pages use shared constants and conversation thread

Import STATUS_LABELS/DEAL_STEPS/STATUS_TO_STEP from lib/deals/constants.
Deal detail shows unified conversation thread with system messages inline.
Remove DealMessages component and pre-deal discussion section. Pass
revision count/limit to actionsFor.

Co-Authored-By: Claude Opus 4 <noreply@anthropic.com>"
```

---

### Task 5: Update Inbox Offer Form & Campaign Actions

**Files:**
- Modify: `app/inbox/[id]/page.tsx`
- Modify: `app/campaigns/[id]/actions.ts`

**Interfaces:**
- Consumes: updated `sendOffer()` with brief fields (Task 3), `accept_campaign_application` RPC (Task 2)
- Produces: offer form with goals/product/talking_points fields, campaign accept with `deal_created` tracking

- [ ] **Step 1: Update offer form in `app/inbox/[id]/page.tsx`**

Replace the "Send an offer" form section. The `note` field becomes three brief fields: `goals` (required), `product_description` (optional), `talking_points` (optional).

Find the form section (lines 332-364) and replace:

```tsx
              <form action={sendOffer} className="mt-3 flex flex-col gap-3">
                <input type="hidden" name="conversation_id" value={conv.id} />
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="offer-offering">Offering</Label>
                  <select
                    id="offer-offering"
                    name="offering_id"
                    required
                    className="h-10 rounded-lg border bg-background px-3 text-sm"
                  >
                    {(offerings ?? []).map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.title} (listed ${(o.price_cents / 100).toFixed(0)})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="offer-price">Agreed price (USD)</Label>
                  <Input id="offer-price" name="price" inputMode="decimal" required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="offer-goals">Goals</Label>
                  <Textarea
                    id="offer-goals"
                    name="goals"
                    rows={3}
                    required
                    maxLength={2000}
                    placeholder="What does success look like for this collaboration?"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="offer-product">Product (optional)</Label>
                  <Textarea
                    id="offer-product"
                    name="product_description"
                    rows={2}
                    maxLength={2000}
                    placeholder="Product or service to feature"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="offer-talking">Talking points (optional)</Label>
                  <Textarea
                    id="offer-talking"
                    name="talking_points"
                    rows={2}
                    maxLength={2000}
                    placeholder="Key messages or angles"
                  />
                </div>
                <Button type="submit" size="sm" className="self-start">Send offer</Button>
              </form>
```

Also update the offers list display — change `o.note` to `o.goals`:

In the offers list item (around line 231), replace:
```tsx
{o.note && <p className="mt-2 whitespace-pre-wrap text-sm">{o.note}</p>}
```
with:
```tsx
{o.goals && <p className="mt-2 whitespace-pre-wrap text-sm">{o.goals}</p>}
```

Update the offers select query to include the new fields:
```ts
    supabase
      .from("offers")
      .select("id, offering_id, price_cents, goals, status, deal_id, created_at")
      .eq("conversation_id", conv.id)
      .order("created_at"),
```

- [ ] **Step 2: Update `app/campaigns/[id]/actions.ts`**

The `accept_campaign_application` RPC (Task 2) now uses `create_deal` internally and returns a deal at `accepted` status. The TS callers already track `deal_created` — just ensure the `source` field is `"campaign"`. No changes needed beyond verifying the existing tracking is correct.

Check the `decideApplication()` and `bulkDecideApplications()` functions. They already call `trackServerEvent("deal_created", ...)` with `source: "campaign_application"`. Update this to `source: "campaign"` for consistency:

In `decideApplication()` (around line 109):
```ts
          trackServerEvent("deal_created", app.creator_id, {
            deal_id: dealId,
            source: "campaign",
            campaign_id: campaignId,
            application_id: id,
          });
```

In `bulkDecideApplications()` (around line 175):
```ts
          trackServerEvent("deal_created", app.creator_id, {
            deal_id: dealId,
            source: "campaign",
            campaign_id: campaignId,
            application_id: id,
          });
```

- [ ] **Step 3: Run dev server and verify offer form**

Run: `npx next dev`
Navigate to `/inbox/[id]` for a brand — verify the offer form shows goals, product, and talking points fields.

- [ ] **Step 4: Commit**

```bash
git add app/inbox/[id]/page.tsx app/campaigns/[id]/actions.ts
git commit -m "feat: offer form with brief fields, consistent campaign analytics source

Offer form now has goals (required), product_description, talking_points
instead of a single note field. Campaign deal_created events use
source: 'campaign' consistently.

Co-Authored-By: Claude Opus 4 <noreply@anthropic.com>"
```

---

### Task 6: Final Cleanup & Verification

**Files:**
- Modify: `app/deals/[id]/review-actions.ts` (verify no broken imports)
- Verify: all pages compile and render

**Interfaces:**
- Consumes: all previous tasks
- Produces: clean build, passing tests

- [ ] **Step 1: Grep for stale references**

Search for any remaining references to deleted files, removed states, or old patterns:

```bash
npx grep -r "message-actions" app/
npx grep -r "in_production" app/ lib/
npx grep -r '"funded"' app/ lib/
npx grep -r "begin_production" app/ lib/
npx grep -r "sendMessage" app/deals/
```

Fix any stale imports or references found.

- [ ] **Step 2: Check `review-actions.ts` still works**

Read `app/deals/[id]/review-actions.ts` — it doesn't import from `message-actions.ts` or reference removed states, so it should be fine. Verify.

- [ ] **Step 3: Run tests**

Run: `npx vitest run`
Expected: all tests pass

- [ ] **Step 4: Run type check**

Run: `npx tsc --noEmit`
Expected: no type errors

- [ ] **Step 5: Run dev server and smoke test**

Run: `npx next dev`
Test the following pages load without errors:
- `/deals` — deal list
- `/deals/[id]` — deal detail with conversation thread
- `/inbox/[id]` — conversation with new offer form
- `/book/[offeringId]` — booking page

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: cleanup stale references to removed states and files

Co-Authored-By: Claude Opus 4 <noreply@anthropic.com>"
```

---
