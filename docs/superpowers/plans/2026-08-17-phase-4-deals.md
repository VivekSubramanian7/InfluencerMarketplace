# Phase 4: Deals (Off-Platform Mode) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the marketplace loop without Stripe: brands book offerings with briefs, deals run the full state machine (accept → production → preview → revisions → publish → approve) with per-deal messaging, anti-ghosting timers, mark-as-paid tracking, and two-sided reviews that surface on storefronts.

**Architecture:** All deal mutations go through the Phase-1 `transition_deal()` RPC (extended with a validated jsonb payload for deliverable URLs) and two new narrow RPCs (`mark_deal_paid`, timer sweep). UI affordances come from a pure `actionsFor()` helper wrapping the Phase-1 `canTransition`. Deal pages are dynamic (cookie client + RLS); the storefront gains Book buttons and a public reviews section. Timers run via `pg_cron` calling a security-definer sweep — the same idempotent path a webhook worker will reuse when Stripe lands.

**Tech Stack:** Existing stack; `pg_cron` (ships with the local Supabase image). No new npm dependencies.

**Spec:** `docs/superpowers/specs/2026-08-16-video-micro-influencer-marketplace-design.md` (deal state machine incl. the escrow-optional amendment and the 2026-08-17 cancellation ruling).

## Global Constraints

- Every deal status change goes through `transition_deal()` — no direct writes, ever. `preview_url`/`live_url` are set ONLY inside that function (columns have no app-role update grant).
- Payment mode for every deal created in this phase is `'off_platform'` (Stripe is not configured; the escrow path stays dormant by design). Deal pages must show the off-platform banner to both sides (spec requirement).
- Actor rules (Phase 1): brand/creator = participant identity via auth.uid(); `system` = only null-uid (service role / cron as postgres); admin via profiles.role.
- Timers: 72h accept deadline (`expire_accept` from requested/funded), 5-day auto-approve (`auto_approve` from published) — spec values, enforced by the sweep, idempotent.
- Deliverable URLs must be absolute http(s) (validated in SQL with `~* '^https?://'` — same rule as migration 0007).
- Reviews: one per author per deal, only when `status='completed'`, rating 1-5 (DB-enforced already); after submitting, revalidate the creator's storefront.
- Server actions: `redirect()` never in try/catch; cookie client for authenticated reads/writes; friendly `?error=` messages.
- Local Supabase workflow as before (`npx supabase migration up` / `db reset`; docker-exec psql; explicit grants for anything new).
- Commit after every task; `npm test` / `npm run lint` / `npm run build` clean before each commit.

---

### Task 1: Migration 0010 — transition payload + mark-paid RPC

**Files:**
- Create: `supabase/migrations/0010_deal_rpcs.sql`

**Interfaces:**
- Produces:
  - `transition_deal(p_deal_id uuid, p_action text, p_actor_role text, p_payload jsonb default '{}')` — same behavior as Phase 1 plus: `submit_preview` REQUIRES payload `preview_url` (http(s)); `mark_published` REQUIRES `live_url` (http(s)); both stored on the deal and echoed into `deal_events.metadata`. Old 3-arg callers break — none exist in app code yet (Phase 1 only called it from SQL).
  - `mark_deal_paid(p_deal_id uuid) returns deals` — brand-only, off_platform-only, allowed in statuses `accepted|in_production|submitted|revision_requested|published|completed`; sets `marked_paid_at = now()` once (error if already set); appends a `deal_events` row (action `mark_paid`).

- [ ] **Step 1: Write the migration**

`supabase/migrations/0010_deal_rpcs.sql`:
```sql
-- Phase 4: deliverable URLs flow through transition_deal (payload), and
-- off-platform payments get a brand-side "mark as paid" bookkeeping RPC.

drop function public.transition_deal(uuid, text, text);

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

  -- deliverable payload rules
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
    funded_at    = case when v_transition.to_status = 'funded'    then now() else funded_at end,
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

  return v_deal;
end;
$$;

revoke all on function public.transition_deal(uuid, text, text, jsonb) from public;
grant execute on function public.transition_deal(uuid, text, text, jsonb)
  to authenticated, service_role;

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
  if v_deal.status not in ('accepted','in_production','submitted',
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
```

- [ ] **Step 2: Apply** — `npx supabase migration up`. Expected: clean.

- [ ] **Step 3: Verify via psql** (docker exec, as postgres):
```sql
select count(*) from pg_proc where proname='transition_deal';  -- 1 (new signature)
select count(*) from pg_proc where proname='mark_deal_paid';   -- 1
```
Then a functional walkthrough with fixtures (GoTrue users brand+creator per the Phase-1 Task-7 pattern, creator profile + offering, off_platform deal):
- `select public.transition_deal('<DEAL>', 'accept', 'creator')` as service role → error `not the creator` (uid null) — expected; use `expire_accept`/`system` instead to prove the 4-arg default works: returns cancelled.
- Re-seed a deal; walk requested→accepted→in_production via psql is NOT possible for creator actions (uid null) — that's correct behavior; the e2e in Task 9 covers real-user paths. Verify payload validation shape instead:
  `select public.transition_deal('<DEAL2>', 'expire_accept', 'system', '{}'::jsonb);` → cancelled (payload ignored for non-deliverable actions).
- Clean up fixtures.

- [ ] **Step 4: Commit**

```bash
git add supabase
git commit -m "feat: transition payload for deliverable URLs and mark-paid RPC"
```

---

### Task 2: Migration 0011 — deal timers + pg_cron

**Files:**
- Create: `supabase/migrations/0011_deal_timers.sql`

**Interfaces:**
- Produces: `run_deal_timers() returns integer` (count of transitions applied; service-role/owner only) and a `cron.schedule` entry `deal-timers` every 15 minutes. Spec timers: 72h accept deadline, 5-day auto-approve.

- [ ] **Step 1: Write the migration**

`supabase/migrations/0011_deal_timers.sql`:
```sql
-- Anti-ghosting timers (spec: 72h accept deadline, 5-day auto-approve).
-- Runs via pg_cron as postgres (auth.uid() is null -> 'system' actor rules apply).
-- Idempotent: driven purely by status + timestamps; per-deal errors are
-- swallowed so one bad row never blocks the sweep.

create extension if not exists pg_cron;

create function public.run_deal_timers() returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select id from public.deals
    where status in ('requested','funded')
      and requested_at < now() - interval '72 hours'
  loop
    begin
      perform public.transition_deal(r.id, 'expire_accept', 'system');
      n := n + 1;
    exception when others then
      null; -- logged in deal_events only on success; sweep continues
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

revoke all on function public.run_deal_timers() from public;
grant execute on function public.run_deal_timers() to service_role;

select cron.schedule('deal-timers', '*/15 * * * *', 'select public.run_deal_timers()');
```

- [ ] **Step 2: Apply** — `npx supabase migration up`.

- [ ] **Step 3: Verify via psql**:
```sql
select jobname, schedule from cron.job where jobname = 'deal-timers';  -- 1 row, */15
```
Functional: seed an off_platform deal, backdate it (`update public.deals set requested_at = now() - interval '73 hours' where id='<DEAL>';` as postgres), run `select public.run_deal_timers();` → returns ≥1, deal now `cancelled`, `deal_events` has the `expire_accept` row. Repeat the run → returns 0 (idempotent). Clean up fixtures.

- [ ] **Step 4: Commit**

```bash
git add supabase
git commit -m "feat: deal timer sweep on pg_cron (72h accept, 5-day auto-approve)"
```

---

### Task 3: UI action map (pure, TDD)

**Files:**
- Create: `lib/deals/ui-actions.ts`
- Test: `lib/deals/__tests__/ui-actions.test.ts`

**Interfaces:**
- Consumes: `canTransition`, types from `@/lib/deals/machine` (Phase 1).
- Produces (Task 6 renders these):
  ```ts
  interface UiAction {
    action: DealAction;
    label: string;
    needsUrl: "preview_url" | "live_url" | null;
    confirm: boolean;      // destructive/irreversible → confirm UI
  }
  actionsFor(status: DealStatus, role: "brand" | "creator", mode: PaymentMode): UiAction[]
  ```

- [ ] **Step 1: Write failing tests**

`lib/deals/__tests__/ui-actions.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { actionsFor } from "@/lib/deals/ui-actions";

const acts = (s: Parameters<typeof actionsFor>[0], r: "brand" | "creator",
              m: Parameters<typeof actionsFor>[2] = "off_platform") =>
  actionsFor(s, r, m).map((a) => a.action);

describe("actionsFor", () => {
  it("creator on a fresh off_platform request: accept or decline", () => {
    expect(acts("requested", "creator")).toEqual(["accept", "decline"]);
  });

  it("brand on a fresh request: cancel only", () => {
    expect(acts("requested", "brand")).toEqual(["cancel"]);
  });

  it("accepted: creator starts production or cancels; brand can cancel or dispute? (no dispute pre-flight per machine)", () => {
    expect(acts("accepted", "creator")).toEqual(["begin_production", "cancel", "dispute"]);
    expect(acts("accepted", "brand")).toEqual(["cancel", "dispute"]);
  });

  it("submitted: brand approves-revision loop; creator publishes", () => {
    expect(acts("submitted", "brand")).toEqual(["request_revision", "dispute"]);
    expect(acts("submitted", "creator")).toEqual(["mark_published", "dispute"]);
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
    const submit = actionsFor("in_production", "creator", "off_platform")
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

  it("escrow mode: creator cannot accept before funding", () => {
    expect(acts("requested", "creator", "escrow")).toEqual([]);
    expect(acts("funded", "creator", "escrow")).toEqual(["accept", "decline"]);
  });
});
```

- [ ] **Step 2: Run to verify failure** — focused vitest → FAIL (module not found).

- [ ] **Step 3: Implement**

`lib/deals/ui-actions.ts`:
```ts
import {
  canTransition, DealAction, DealStatus, PaymentMode,
} from "@/lib/deals/machine";

export interface UiAction {
  action: DealAction;
  label: string;
  needsUrl: "preview_url" | "live_url" | null;
  confirm: boolean;
}

// Order here is display order. Only user-facing actions (no system/admin).
const CANDIDATES: UiAction[] = [
  { action: "accept", label: "Accept deal", needsUrl: null, confirm: false },
  { action: "decline", label: "Decline", needsUrl: null, confirm: true },
  { action: "begin_production", label: "Start production", needsUrl: null, confirm: false },
  { action: "submit_preview", label: "Submit preview", needsUrl: "preview_url", confirm: false },
  { action: "request_revision", label: "Request changes", needsUrl: null, confirm: false },
  { action: "mark_published", label: "Mark as published", needsUrl: "live_url", confirm: false },
  { action: "approve", label: "Approve & complete", needsUrl: null, confirm: false },
  { action: "cancel", label: "Cancel deal", needsUrl: null, confirm: true },
  { action: "dispute", label: "Open dispute", needsUrl: null, confirm: true },
];

export function actionsFor(
  status: DealStatus,
  role: "brand" | "creator",
  mode: PaymentMode
): UiAction[] {
  return CANDIDATES.filter((c) => canTransition(status, c.action, role, mode));
}
```

- [ ] **Step 4: Run tests** — focused PASS; `npm test` all green. (If any expectation disagrees with the actual machine table, the MACHINE is the authority — fix the test's expected list to match `canTransition` and note it in the report; do not touch machine.ts.)

- [ ] **Step 5: Commit**

```bash
git add lib/deals
git commit -m "feat: pure UI action map over the deal state machine"
```

---

### Task 4: Booking flow + storefront Book buttons

**Files:**
- Create: `app/book/[offeringId]/page.tsx`, `app/book/[offeringId]/actions.ts`
- Modify: `app/c/[handle]/page.tsx` (add a Book link per offering card)

**Interfaces:**
- Consumes: `requireRole("brand")`, `createServerSupabase()`, `parseOptionalText`/`parseText` from `@/lib/storefront/validation`.
- Produces: route `/book/[offeringId]` (brand-gated brief form); server action `createBooking(formData)` → creates deal (`payment_mode: 'off_platform'`) + brief, redirects to `/deals/[id]`. Storefront offering cards gain `Book this` links (only change to the storefront page; keep it ISR-safe — `Link` is static).

- [ ] **Step 1: Server action**

`app/book/[offeringId]/actions.ts`:
```ts
"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseOptionalText, parseText } from "@/lib/storefront/validation";

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

  const { data: deal, error: dErr } = await supabase
    .from("deals")
    .insert({
      brand_id: user.id,
      creator_id: offering.creator_id,
      offering_id: offering.id,
      offering_type: offering.type,
      offering_title: offering.title,
      price_cents: offering.price_cents,
      currency: offering.currency,
      revision_limit: offering.revision_limit,
      payment_mode: "off_platform",
      status: "requested",
    })
    .select("id")
    .single();
  if (dErr || !deal) {
    redirect(`/book/${offeringId}?error=` + encodeURIComponent(dErr?.message ?? "Booking failed"));
  }

  const { error: bErr } = await supabase.from("briefs").insert({
    deal_id: deal.id,
    goals,
    product_description: product.value,
    talking_points: talking.value,
  });
  if (bErr) {
    redirect(`/deals/${deal.id}?error=` +
      encodeURIComponent("Deal created but the brief failed to save: " + bErr.message));
  }

  redirect(`/deals/${deal.id}`);
}
```

- [ ] **Step 2: Booking page**

`app/book/[offeringId]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { createBooking } from "./actions";

export default async function BookOfferingPage({
  params, searchParams,
}: {
  params: Promise<{ offeringId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireRole("brand");
  const { offeringId } = await params;
  const { error } = await searchParams;
  const supabase = await createServerSupabase();

  const { data: offering } = await supabase
    .from("offerings")
    .select("id, title, type, price_cents, turnaround_days, revision_limit, creator_id, active")
    .eq("id", offeringId)
    .maybeSingle();
  if (!offering || !offering.active) notFound();

  const { data: creator } = await supabase
    .from("creator_profiles")
    .select("handle")
    .eq("user_id", offering.creator_id)
    .maybeSingle();

  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-2xl font-semibold mb-1">Book: {offering.title}</h1>
      <p className="text-gray-600 mb-6">
        {creator ? <>by @{creator.handle} · </> : null}
        ${(offering.price_cents / 100).toFixed(2)} · {offering.turnaround_days}d turnaround ·{" "}
        {offering.revision_limit} revision{offering.revision_limit === 1 ? "" : "s"}
      </p>
      <p className="mb-6 text-sm border rounded p-3 bg-gray-50">
        Payment is handled outside the platform for now — you and the creator
        agree on payment directly. The deal tracker keeps both sides honest.
      </p>
      {error && <p className="mb-4 text-red-600">{error}</p>}

      <form action={createBooking} className="flex flex-col gap-4">
        <input type="hidden" name="offering_id" value={offering.id} />
        <label className="flex flex-col gap-1">
          <span>Goals — what does success look like? *</span>
          <textarea name="goals" rows={4} className="border rounded p-2" required />
        </label>
        <label className="flex flex-col gap-1">
          <span>Product / service description</span>
          <textarea name="product_description" rows={3} className="border rounded p-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span>Key talking points</span>
          <textarea name="talking_points" rows={3} className="border rounded p-2" />
        </label>
        <button className="bg-black text-white rounded p-2">Send booking request</button>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Storefront Book links** — in `app/c/[handle]/page.tsx`, inside the offering `<li>` (after the description), add:
```tsx
<a href={`/book/${o.id}`} className="inline-block border rounded px-4 py-2 mt-3 text-sm">
  Book this
</a>
```
(Plain `<a>`, static — keeps the page ISR-eligible; imports unchanged.)

- [ ] **Step 4: Verify** — `npm run build` clean (`/c/[handle]` STILL ISR `●`; `/book/[offeringId]` dynamic); `npm test` green; `npm run lint` exit 0. Manual: brand books a live creator's offering end-to-end → lands on `/deals/<id>` (404 until Task 6 — landing on the URL with the deal row created, verified via psql, is the pass bar here); creator visiting `/book/...` is bounced to `/`; booking an inactive offering redirects to `/discover` with the friendly error; deal row has forced snapshot + `payment_mode='off_platform'` + brief row present.

- [ ] **Step 5: Commit**

```bash
git add app/book "app/c/[handle]/page.tsx"
git commit -m "feat: booking flow with brief and storefront book buttons"
```

---

### Task 5: Deals pipeline list

**Files:**
- Create: `app/deals/page.tsx`

**Interfaces:**
- Consumes: `requireUser()` (both roles see it), `createServerSupabase()`.
- Produces: `/deals` — the pipeline view: deals for the current user (as brand or creator per their role), grouped into Action needed / In progress / Done buckets. Task 6's detail pages link back here.

- [ ] **Step 1: The page**

`app/deals/page.tsx`:
```tsx
import Link from "next/link";
import { requireUser } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { actionsFor } from "@/lib/deals/ui-actions";
import type { DealStatus, PaymentMode } from "@/lib/deals/machine";

const STATUS_LABELS: Record<string, string> = {
  requested: "Awaiting creator", funded: "Funded",
  accepted: "Accepted", in_production: "In production",
  submitted: "Preview submitted", revision_requested: "Changes requested",
  published: "Published — awaiting approval", completed: "Completed",
  cancelled: "Cancelled", disputed: "Disputed",
};

const DONE: DealStatus[] = ["completed", "cancelled"];

export default async function DealsPage() {
  const { user, role } = await requireUser();
  const supabase = await createServerSupabase();

  const { data: deals, error } = await supabase
    .from("deals")
    .select("id, offering_title, price_cents, status, payment_mode, requested_at, brand_id, creator_id")
    .or(`brand_id.eq.${user.id},creator_id.eq.${user.id}`)
    .order("requested_at", { ascending: false });
  if (error) throw new Error("deals query failed: " + error.message);

  const mine = deals ?? [];
  const myRole = (d: { brand_id: string }) => (d.brand_id === user.id ? "brand" : "creator");
  const needsMe = mine.filter(
    (d) => !DONE.includes(d.status as DealStatus) && d.status !== "disputed" &&
      actionsFor(d.status as DealStatus, myRole(d), d.payment_mode as PaymentMode)
        .some((a) => !a.confirm)
  );
  const inFlight = mine.filter(
    (d) => !DONE.includes(d.status as DealStatus) && !needsMe.includes(d)
  );
  const done = mine.filter((d) => DONE.includes(d.status as DealStatus));

  const section = (title: string, rows: typeof mine) => (
    <section className="mb-8">
      <h2 className="text-lg font-medium mb-3">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">Nothing here.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((d) => (
            <li key={d.id}>
              <Link href={`/deals/${d.id}`}
                className="border rounded p-4 flex justify-between items-center gap-4 hover:bg-gray-50">
                <span className="min-w-0 truncate">
                  {d.offering_title}
                  <span className="text-gray-500"> · {myRole(d) === "brand" ? "buying" : "selling"}</span>
                </span>
                <span className="flex items-center gap-4 shrink-0">
                  <span className="text-sm text-gray-600">{STATUS_LABELS[d.status] ?? d.status}</span>
                  <span>${(d.price_cents / 100).toFixed(2)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Your deals</h1>
        <Link className="text-sm underline"
          href={role === "creator" ? "/dashboard" : "/discover"}>
          {role === "creator" ? "Dashboard" : "Find creators"}
        </Link>
      </div>
      {section("Action needed", needsMe)}
      {section("In progress", inFlight)}
      {section("Done", done)}
    </main>
  );
}
```

- [ ] **Step 2: Verify** — build/test/lint clean. Manual with the Task 4 deal: brand sees it under "In progress" (their only non-confirm action is none: cancel is confirm-only) and creator sees it under "Action needed" (accept is available).

- [ ] **Step 3: Commit**

```bash
git add app/deals/page.tsx
git commit -m "feat: role-aware deal pipeline list"
```

---

### Task 6: Deal detail with transitions

**Files:**
- Create: `app/deals/[id]/page.tsx`, `app/deals/[id]/actions.ts`

**Interfaces:**
- Consumes: `actionsFor` (T3), `transition_deal` RPC 4-arg (T1), `mark_deal_paid` RPC (T1), `requireUser()`.
- Produces: `/deals/[id]` — status header + off-platform banner, brief, deliverable links, action buttons (URL input when `needsUrl`), mark-as-paid (brand), event timeline. Server actions `performDealAction(formData)` (keys: deal_id, action, url?) and `markPaid(formData)` (deal_id). Task 7 adds the message thread to this page; Task 8 adds the review form.

- [ ] **Step 1: Server actions**

`app/deals/[id]/actions.ts`:
```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseMediaUrl } from "@/lib/storefront/validation";

const USER_ACTIONS = new Set([
  "accept", "decline", "begin_production", "submit_preview",
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

  const { error } = await supabase.rpc("transition_deal", {
    p_deal_id: dealId,
    p_action: action,
    p_actor_role: role,
    p_payload: payload,
  });
  if (error) {
    redirect(`/deals/${dealId}?error=` + encodeURIComponent(error.message));
  }
  revalidatePath(`/deals/${dealId}`);
  redirect(`/deals/${dealId}`);
}

export async function markPaid(formData: FormData) {
  await requireUser();
  const supabase = await createServerSupabase();
  const dealId = String(formData.get("deal_id") ?? "");

  const { error } = await supabase.rpc("mark_deal_paid", { p_deal_id: dealId });
  if (error) {
    redirect(`/deals/${dealId}?error=` + encodeURIComponent(error.message));
  }
  revalidatePath(`/deals/${dealId}`);
  redirect(`/deals/${dealId}`);
}
```

- [ ] **Step 2: The page**

`app/deals/[id]/page.tsx`:
```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { actionsFor } from "@/lib/deals/ui-actions";
import type { DealStatus, PaymentMode } from "@/lib/deals/machine";
import { markPaid, performDealAction } from "./actions";

const STATUS_LABELS: Record<string, string> = {
  requested: "Awaiting creator response", funded: "Funded",
  accepted: "Accepted — production starting", in_production: "In production",
  submitted: "Preview submitted", revision_requested: "Changes requested",
  published: "Published — awaiting brand approval", completed: "Completed",
  cancelled: "Cancelled", disputed: "Disputed — admin will review",
};

export default async function DealPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { user, role } = await requireUser();
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createServerSupabase();

  const { data: deal } = await supabase
    .from("deals")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!deal) notFound(); // RLS hides other people's deals

  const myRole = deal.brand_id === user.id ? "brand" : "creator";
  const [{ data: brief }, { data: events }, { data: counterpartProfile }] = await Promise.all([
    supabase.from("briefs").select("goals, product_description, talking_points").eq("deal_id", id).maybeSingle(),
    supabase.from("deal_events").select("action, from_status, to_status, created_at").eq("deal_id", id).order("created_at"),
    supabase.from("profiles").select("display_name")
      .eq("id", myRole === "brand" ? deal.creator_id : deal.brand_id).maybeSingle(),
  ]);

  const actions = role === "admin" ? [] :
    actionsFor(deal.status as DealStatus, myRole, deal.payment_mode as PaymentMode);

  return (
    <main className="mx-auto max-w-2xl p-8">
      <Link href="/deals" className="text-sm underline">← All deals</Link>
      <h1 className="text-2xl font-semibold mt-2 mb-1">{deal.offering_title}</h1>
      <p className="text-gray-600 mb-1">
        {myRole === "brand" ? "You booked" : "Booked by"}{" "}
        {counterpartProfile?.display_name ?? "counterpart"} · ${(deal.price_cents / 100).toFixed(2)}
      </p>
      <p className="mb-4 font-medium">{STATUS_LABELS[deal.status] ?? deal.status}</p>

      {deal.payment_mode === "off_platform" && (
        <p className="mb-4 text-sm border rounded p-3 bg-amber-50">
          Payment for this deal is handled outside the platform.
          {deal.marked_paid_at
            ? ` The brand marked it paid on ${new Date(deal.marked_paid_at).toLocaleDateString()}.`
            : " Agree on payment directly with your counterpart."}
        </p>
      )}
      {error && <p className="mb-4 text-red-600">{error}</p>}

      {(deal.preview_url || deal.live_url) && (
        <section className="mb-6 border rounded p-4">
          <h2 className="font-medium mb-2">Deliverables</h2>
          {deal.preview_url && (
            <p className="text-sm">Preview:{" "}
              <a className="underline break-all" href={deal.preview_url}
                target="_blank" rel="noopener noreferrer">{deal.preview_url}</a></p>
          )}
          {deal.live_url && (
            <p className="text-sm">Live post:{" "}
              <a className="underline break-all" href={deal.live_url}
                target="_blank" rel="noopener noreferrer">{deal.live_url}</a></p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            Revisions used: {deal.revision_count} of {deal.revision_limit}
          </p>
        </section>
      )}

      {brief && (
        <section className="mb-6 border rounded p-4">
          <h2 className="font-medium mb-2">Brief</h2>
          <p className="text-sm whitespace-pre-line mb-2"><strong>Goals:</strong> {brief.goals}</p>
          {brief.product_description && (
            <p className="text-sm whitespace-pre-line mb-2">
              <strong>Product:</strong> {brief.product_description}</p>
          )}
          {brief.talking_points && (
            <p className="text-sm whitespace-pre-line">
              <strong>Talking points:</strong> {brief.talking_points}</p>
          )}
        </section>
      )}

      {actions.length > 0 && (
        <section className="mb-6 border rounded p-4">
          <h2 className="font-medium mb-3">Next steps</h2>
          <div className="flex flex-col gap-3">
            {actions.map((a) => (
              <form key={a.action} action={performDealAction} className="flex gap-2 items-start">
                <input type="hidden" name="deal_id" value={deal.id} />
                <input type="hidden" name="action" value={a.action} />
                {a.needsUrl && (
                  <input name="url" type="url" required
                    placeholder={a.needsUrl === "preview_url" ? "Link to your preview" : "Link to the live post"}
                    className="border rounded p-2 flex-1" />
                )}
                <button
                  className={a.confirm
                    ? "border border-red-300 text-red-700 rounded px-4 py-2"
                    : "bg-black text-white rounded px-4 py-2"}>
                  {a.label}
                </button>
              </form>
            ))}
          </div>
        </section>
      )}

      {myRole === "brand" && deal.payment_mode === "off_platform" && !deal.marked_paid_at &&
        !["requested", "cancelled"].includes(deal.status) && (
        <form action={markPaid} className="mb-6">
          <input type="hidden" name="deal_id" value={deal.id} />
          <button className="border rounded px-4 py-2 text-sm">Mark as paid</button>
        </form>
      )}

      <section className="mb-6">
        <h2 className="font-medium mb-2">Timeline</h2>
        <ul className="text-sm text-gray-600 flex flex-col gap-1">
          {(events ?? []).map((e, i) => (
            <li key={i}>
              {new Date(e.created_at).toLocaleString()} — {e.action}
              {e.from_status !== e.to_status ? ` (${e.from_status} → ${e.to_status})` : ""}
            </li>
          ))}
          {(events ?? []).length === 0 && <li>Requested {new Date(deal.requested_at).toLocaleString()}</li>}
        </ul>
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Verify** — build/test/lint clean. Manual (two browser sessions or sequential logins): walk a full off_platform deal — creator accepts, starts production, submits preview (URL required and stored), brand requests changes (revision count increments; second request beyond limit errors friendly), creator resubmits + marks published, brand approves → completed; brand marked-paid once (second attempt errors); timeline shows every event; a third user's deal URL 404s.

- [ ] **Step 4: Commit**

```bash
git add app/deals
git commit -m "feat: deal detail with state-machine actions, deliverables, and mark-paid"
```

---

### Task 7: Per-deal messaging

**Files:**
- Create: `app/deals/[id]/messages.tsx` (server component + form), `app/deals/[id]/message-actions.ts`
- Modify: `app/deals/[id]/page.tsx` (render `<DealMessages dealId={deal.id} userId={user.id} />` between the brief and timeline sections)

**Interfaces:**
- Consumes: messages table RLS (participants read/send), `createServerSupabase()`.
- Produces: `sendMessage(formData)` (deal_id, body 1-5000 chars); `DealMessages` async component (list asc + form).

- [ ] **Step 1: Action**

`app/deals/[id]/message-actions.ts`:
```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseText } from "@/lib/storefront/validation";

export async function sendMessage(formData: FormData) {
  const { user } = await requireUser();
  const supabase = await createServerSupabase();
  const dealId = String(formData.get("deal_id") ?? "");
  const body = parseText(String(formData.get("body") ?? ""), 5000);
  if (!body) {
    redirect(`/deals/${dealId}?error=` + encodeURIComponent("Message must be 1-5000 characters"));
  }

  const { error } = await supabase
    .from("messages")
    .insert({ deal_id: dealId, sender_id: user.id, body });
  if (error) {
    redirect(`/deals/${dealId}?error=` + encodeURIComponent(error.message));
  }
  revalidatePath(`/deals/${dealId}`);
  redirect(`/deals/${dealId}`);
}
```

- [ ] **Step 2: Component**

`app/deals/[id]/messages.tsx`:
```tsx
import { createServerSupabase } from "@/lib/supabase/server";
import { sendMessage } from "./message-actions";

export async function DealMessages({ dealId, userId }: { dealId: string; userId: string }) {
  const supabase = await createServerSupabase();
  const { data: messages } = await supabase
    .from("messages")
    .select("id, sender_id, body, created_at")
    .eq("deal_id", dealId)
    .order("created_at");

  return (
    <section className="mb-6 border rounded p-4">
      <h2 className="font-medium mb-3">Messages</h2>
      <ul className="flex flex-col gap-2 mb-4">
        {(messages ?? []).map((m) => (
          <li key={m.id}
            className={`rounded p-3 text-sm max-w-[85%] ${
              m.sender_id === userId ? "bg-black text-white self-end" : "bg-gray-100 self-start"
            }`}>
            <p className="whitespace-pre-line break-words">{m.body}</p>
            <p className={`text-xs mt-1 ${m.sender_id === userId ? "text-gray-300" : "text-gray-500"}`}>
              {new Date(m.created_at).toLocaleString()}
            </p>
          </li>
        ))}
        {(messages ?? []).length === 0 && (
          <li className="text-sm text-gray-500">No messages yet — say hello.</li>
        )}
      </ul>
      <form action={sendMessage} className="flex gap-2">
        <input type="hidden" name="deal_id" value={dealId} />
        <input name="body" placeholder="Write a message" required maxLength={5000}
          className="border rounded p-2 flex-1" />
        <button className="bg-black text-white rounded px-4">Send</button>
      </form>
    </section>
  );
}
```

- [ ] **Step 3: Wire into the deal page** — import `{ DealMessages }` and render `<DealMessages dealId={deal.id} userId={user.id} />` between the brief section and the actions section (or wherever reads naturally between brief and timeline).

- [ ] **Step 4: Verify** — build/test/lint clean. Manual: both parties exchange messages on a deal (own messages right-aligned dark); non-participant cannot read them (RLS: deal page already 404s); message on someone else's deal_id via the form is rejected by RLS insert policy (error surfaces).

- [ ] **Step 5: Commit**

```bash
git add app/deals
git commit -m "feat: per-deal message thread"
```

---

### Task 8: Reviews — submit + storefront display

**Files:**
- Create: `app/deals/[id]/review-actions.ts`, `supabase/migrations/0012_public_reviews_view.sql`
- Modify: `app/deals/[id]/page.tsx` (review form when completed + not yet reviewed by me), `lib/storefront/queries.ts` (add reviews to Storefront), `app/c/[handle]/page.tsx` (ratings section)

**Why a view:** the anon storefront cannot join reviews→deals directly (deals RLS is participant-only, so the embed would silently return nothing). Same definer-view pattern as `public_creator_stats`:

`supabase/migrations/0012_public_reviews_view.sql`:
```sql
-- Public review surface: brand-authored reviews mapped to the reviewed
-- creator. Definer view (same pattern/justification as public_creator_stats):
-- deals RLS is participant-only, so anon storefront reads need this curated
-- projection. Exposes no brand identity, no deal internals.
create view public.public_creator_reviews
  with (security_invoker = off) as
  select d.creator_id, r.rating, r.body, r.created_at
  from public.reviews r
  join public.deals d on d.id = r.deal_id
  where r.author_id = d.brand_id;
grant select on public.public_creator_reviews to anon, authenticated;
```
Apply with `npx supabase migration up` before the code steps. (Advisors will add one more `security_definer_view` finding — expected and triaged, same justification as the stats view; note it in your report.)

**Interfaces:**
- Consumes: reviews table (insert policy: participants, completed deals, one per author — DB-enforced), `parseIntInRange`/`parseOptionalText`.
- Produces: `submitReview(formData)` (deal_id, rating 1-5, body ≤1000); `Storefront` gains `reviews: { rating: number; body: string | null; createdAt: string }[]` and `avgRating: number | null` (computed over ALL that creator's reviews via their completed deals).

- [ ] **Step 1: Action**

`app/deals/[id]/review-actions.ts`:
```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseIntInRange, parseOptionalText } from "@/lib/storefront/validation";

export async function submitReview(formData: FormData) {
  const { user } = await requireUser();
  const supabase = await createServerSupabase();
  const dealId = String(formData.get("deal_id") ?? "");

  const rating = parseIntInRange(String(formData.get("rating") ?? ""), 1, 5);
  if (rating === null) {
    redirect(`/deals/${dealId}?error=` + encodeURIComponent("Pick a rating from 1 to 5"));
  }
  const body = parseOptionalText(String(formData.get("body") ?? ""), 1000);
  if (!body.ok) {
    redirect(`/deals/${dealId}?error=` + encodeURIComponent("Review is too long (max 1000 characters)"));
  }

  const { error } = await supabase
    .from("reviews")
    .insert({ deal_id: dealId, author_id: user.id, rating, body: body.value });
  if (error) {
    const msg = error.code === "23505" ? "You already reviewed this deal" : error.message;
    redirect(`/deals/${dealId}?error=` + encodeURIComponent(msg));
  }

  // refresh the reviewed creator's public storefront
  const { data: deal } = await supabase
    .from("deals").select("creator_id").eq("id", dealId).maybeSingle();
  if (deal) {
    const { data: cp } = await supabase
      .from("creator_profiles").select("handle").eq("user_id", deal.creator_id).maybeSingle();
    if (cp?.handle) revalidatePath(`/c/${cp.handle}`);
  }

  revalidatePath(`/deals/${dealId}`);
  redirect(`/deals/${dealId}`);
}
```

- [ ] **Step 2: Review form on the deal page** — in `app/deals/[id]/page.tsx`, extend the parallel fetch with my existing review (`supabase.from("reviews").select("id").eq("deal_id", id).eq("author_id", user.id).maybeSingle()`), and when `deal.status === "completed"` and no existing review, render before the Timeline:
```tsx
<section className="mb-6 border rounded p-4">
  <h2 className="font-medium mb-3">Leave a review</h2>
  <form action={submitReview} className="flex flex-col gap-3">
    <input type="hidden" name="deal_id" value={deal.id} />
    <label className="flex items-center gap-2">
      <span>Rating</span>
      <select name="rating" className="border rounded p-2" defaultValue="5">
        {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
    </label>
    <textarea name="body" rows={3} placeholder="How was the collaboration?"
      className="border rounded p-2" />
    <button className="bg-black text-white rounded p-2 self-start px-6">Submit review</button>
  </form>
</section>
```
(import `submitReview` from `./review-actions`.)

- [ ] **Step 3: Storefront reviews** — in `lib/storefront/queries.ts`, add to the interface:
```ts
reviews: Array<{ rating: number; body: string | null; createdAt: string }>;
avgRating: number | null;
```
and in `getStorefront`, add a fifth parallel query against the new view (brand-authored reviews only, already filtered by the view):
```ts
supabase
  .from("public_creator_reviews")
  .select("rating, body, created_at")
  .eq("creator_id", cp.user_id)
  .order("created_at", { ascending: false })
  .limit(10),
```
Throw on error like the others. Map to the interface and compute `avgRating` over the fetched rows (1 decimal via `Math.round(avg * 10) / 10`, null when empty).

In `app/c/[handle]/page.tsx`, after the Offerings section:
```tsx
{storefront.reviews.length > 0 && (
  <section className="mb-8">
    <h2 className="text-xl font-medium mb-3">
      Brand reviews {storefront.avgRating !== null && <>· ★ {storefront.avgRating}</>}
    </h2>
    <ul className="flex flex-col gap-3">
      {storefront.reviews.map((r, i) => (
        <li key={i} className="border rounded p-4">
          <p className="text-sm font-medium">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</p>
          {r.body && <p className="text-sm mt-1 whitespace-pre-line">{r.body}</p>}
          <p className="text-xs text-gray-400 mt-1">{new Date(r.createdAt).toLocaleDateString()}</p>
        </li>
      ))}
    </ul>
  </section>
)}
```
(destructure `reviews`/`avgRating` alongside the existing fields — adjust the existing destructuring line.)

- [ ] **Step 4: Verify** — build/test/lint clean (storefront STILL ISR). Manual: complete a deal, both sides review (duplicate blocked with friendly message; review on a non-completed deal blocked by RLS), storefront shows the brand's review + avg after revalidation.

- [ ] **Step 5: Commit**

```bash
git add app/deals lib/storefront "app/c/[handle]/page.tsx"
git commit -m "feat: two-sided reviews with storefront ratings"
```

---

### Task 9: Phase 4 verification sweep

**Files:** none created; checks + full-lifecycle e2e.

- [ ] **Step 1: Gates** — `npm test` / `npm run lint` / `npm run build` (route table: `/c/[handle]` ISR; `/book/...`, `/deals/...` dynamic).

- [ ] **Step 2: Advisors** — `npx supabase db advisors --local`: nothing new beyond the two triaged carry-forwards.

- [ ] **Step 3: Full-lifecycle e2e** (dev server, browser javascript_tool, psql for assertions; fixtures on …@e2e4.local):
  1. Creator (live profile + offering) and brand accounts exist
  2. Brand books via the storefront Book button → brief form → deal created (`off_platform`, snapshot forced, brief saved), lands on `/deals/[id]` with off-platform banner
  3. `/deals` buckets look right for both roles
  4. Full happy path: accept → begin production → submit preview (URL) → request changes → resubmit → mark published (URL) → approve → completed; timeline shows all events; revision counter enforced at the limit
  5. Messaging both directions mid-flight
  6. Brand marks paid (once; second errors)
  7. Both sides review; duplicate blocked; storefront shows rating + review
  8. Timers: seed a second deal, backdate `requested_at` 73h → `select public.run_deal_timers();` → cancelled; seed a third at published, backdate `published_at` 6 days → auto-approved to completed; re-run → 0 more transitions
  9. Decline path and brand-cancel path each produce cancelled with correct events
  10. Security spot-checks: non-participant deal URL → 404; direct `update deals set status...` as authenticated → 0 rows; `transition_deal` with the other side's role → error
  11. Clean up all e2e users/fixtures

- [ ] **Step 4: Commit fixes** (only if the sweep changed something)

```bash
git add -A
git commit -m "chore: phase 4 verification fixes"
```
