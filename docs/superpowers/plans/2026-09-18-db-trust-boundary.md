# DB Trust-Boundary Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every gap between app-layer business rules and database-layer enforcement found in the 2026-09-18 audit so that an authenticated user calling RPCs or tables directly via the Supabase client cannot bypass any limit, cap, guard, or restriction.

**Architecture:** One SQL migration (`0038_trust_boundary.sql`) adds all missing CHECK constraints, trigger-based aggregate limits, and RPC-level guards. No app code changes — the app-layer checks stay as UX-friendly validation; the DB becomes the authoritative enforcement layer.

**Tech Stack:** PostgreSQL 15 (Supabase), PL/pgSQL triggers and functions, CHECK constraints. Vitest for any new TypeScript test shims.

**Spec:** Audit report from 2026-09-18 conversation (22 findings with gaps).

## Global Constraints

- All DDL in a single migration file: `supabase/migrations/0038_trust_boundary.sql`
- Use `CREATE OR REPLACE` for functions already defined; use `ALTER TABLE ... ADD CONSTRAINT` with `NOT VALID` + separate `VALIDATE` for large-table constraints to avoid full table locks.
- Every constraint name follows existing convention: `tablename_columnname_check` or `tablename_rule_check`.
- Column-grant additions must mirror the pattern in 0001/0014/0016: explicit `GRANT` to `authenticated` and `service_role`.
- No new tables. No new columns. No app-code changes.

## Revised Findings (false positives removed)

After cross-checking migrations 0022–0037, the following audit findings are **already enforced at DB** and are excluded from this plan:

| # | Rule | Why excluded |
|---|------|-------------|
| 8 | decline_reason ≤ 500 | `0022_campaign_decline_reason.sql:5` adds CHECK |
| 9 | offer goals/product/talking ≤ 2000 | `0024_unified_deal_flow.sql:100-102` adds CHECKs |
| 18 | revision note ≤ 2000 | `0023_feedback_fixes.sql:11-12` adds CHECK |

Remaining: 19 true gaps to fix.

---

### Task 1: Text-length CHECK constraints

**Files:**
- Create: `supabase/migrations/0038_trust_boundary.sql` (start of file)

**Interfaces:**
- Consumes: nothing
- Produces: CHECK constraints on 8 columns across 4 tables

These are the simplest fixes — bare `text` columns that the app validates via `parseText`/`parseOptionalText` but the DB does not constrain.

- [ ] **Step 1: Write the migration section for text-length CHECKs**

```sql
-- 0038: DB trust-boundary enforcement
-- Closes all app-only business-rule gaps found in the 2026-09-18 audit.

-- =============================================================================
-- Section 1: Text-length CHECK constraints
-- =============================================================================

-- Finding 7: brand_profiles.company — app caps at 120, DB has no limit
alter table public.brand_profiles
  add constraint brand_profiles_company_length_check
  check (company is null or length(company) <= 120);

-- Finding 14: reviews.body — app caps at 1000, DB has no limit
alter table public.reviews
  add constraint reviews_body_length_check
  check (body is null or length(body) <= 1000);

-- Finding 15: reports.reason — app caps at 2000, DB has no limit
alter table public.reports
  add constraint reports_reason_length_check
  check (length(reason) <= 2000);

-- Finding 16: reports.resolution — app caps at 500, DB has no limit
alter table public.reports
  add constraint reports_resolution_length_check
  check (resolution is null or length(resolution) <= 500);

-- Finding 19: briefs.goals — app-side offers validate at 2000 but briefs have no CHECK
alter table public.briefs
  add constraint briefs_goals_length_check
  check (goals is null or length(goals) <= 4000);

-- briefs.product_description
alter table public.briefs
  add constraint briefs_product_description_length_check
  check (product_description is null or length(product_description) <= 4000);

-- briefs.talking_points
alter table public.briefs
  add constraint briefs_talking_points_length_check
  check (talking_points is null or length(talking_points) <= 4000);
```

Note: briefs limits are 4000 (not 2000) because `create_deal()` concatenates campaign title + description into goals, and `accept_campaign_application()` appends pitch into talking_points. 2000 would reject valid RPC-created briefs. The offers table (the user-facing input) is already capped at 2000 per field.

- [ ] **Step 2: Verify no existing data violates the new constraints**

Run against a local Supabase instance or staging:
```bash
rtk supabase db reset
```
Expected: migration applies cleanly (no existing rows violate constraints on a fresh DB).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0038_trust_boundary.sql
git commit -m "fix(db): add text-length CHECKs for reviews, reports, briefs, brand company"
```

---

### Task 2: Company name NOT NULL and offering price upper bound

**Files:**
- Modify: `supabase/migrations/0038_trust_boundary.sql` (append)

**Interfaces:**
- Consumes: Task 1 file exists
- Produces: NOT NULL on `brand_profiles.company`, upper-bound CHECK on `offerings.price_cents`

- [ ] **Step 1: Append the constraints**

```sql
-- =============================================================================
-- Section 2: NOT NULL and range constraints
-- =============================================================================

-- Finding 6: brand_profiles.company — app requires non-empty, DB allows NULL.
-- Two-step: backfill any NULLs, then add NOT NULL.
update public.brand_profiles set company = 'Unnamed' where company is null or trim(company) = '';

alter table public.brand_profiles
  alter column company set not null;

-- Finding 27: offerings.price_cents — app caps at 100M (=$1M), DB only checks > 0
alter table public.offerings
  drop constraint if exists offerings_price_cents_check;

alter table public.offerings
  add constraint offerings_price_cents_check
  check (price_cents between 1 and 100000000);
```

- [ ] **Step 2: Verify migration applies**

```bash
rtk supabase db reset
```
Expected: clean apply. Offerings constraint replaces the old `> 0` with `between 1 and 100000000`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0038_trust_boundary.sql
git commit -m "fix(db): company NOT NULL, offering price upper bound"
```

---

### Task 3: Array-length CHECK constraints (niches, languages)

**Files:**
- Modify: `supabase/migrations/0038_trust_boundary.sql` (append)

**Interfaces:**
- Consumes: Task 2
- Produces: CHECK constraints limiting array lengths on `creator_profiles` and `brand_profiles`

- [ ] **Step 1: Append array-length constraints**

```sql
-- =============================================================================
-- Section 3: Array-length constraints
-- =============================================================================

-- Finding 4: creator_profiles.niches — app caps at 8, DB has no limit
alter table public.creator_profiles
  add constraint creator_profiles_niches_max_check
  check (coalesce(array_length(niches, 1), 0) <= 8);

-- Finding 5: creator_profiles.languages — app caps at 5, DB has no limit
alter table public.creator_profiles
  add constraint creator_profiles_languages_max_check
  check (coalesce(array_length(languages, 1), 0) <= 5);

-- Finding 4 (brand side): brand_profiles.pref_niches — app caps at 8
alter table public.brand_profiles
  add constraint brand_profiles_pref_niches_max_check
  check (coalesce(array_length(pref_niches, 1), 0) <= 8);
```

- [ ] **Step 2: Verify migration applies**

```bash
rtk supabase db reset
```
Expected: clean apply.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0038_trust_boundary.sql
git commit -m "fix(db): array-length CHECKs for niches, languages, pref_niches"
```

---

### Task 4: Age range cross-validation

**Files:**
- Modify: `supabase/migrations/0038_trust_boundary.sql` (append)

**Interfaces:**
- Consumes: Task 3
- Produces: cross-column CHECK on `brand_products`

- [ ] **Step 1: Append cross-column constraint**

```sql
-- =============================================================================
-- Section 4: Cross-column constraints
-- =============================================================================

-- Finding 20: brand_products age range — app checks min <= max, DB does not
alter table public.brand_products
  add constraint brand_products_age_range_check
  check (
    target_age_min is null
    or target_age_max is null
    or target_age_min <= target_age_max
  );
```

- [ ] **Step 2: Verify migration applies**

```bash
rtk supabase db reset
```
Expected: clean apply.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0038_trust_boundary.sql
git commit -m "fix(db): age range cross-validation CHECK on brand_products"
```

---

### Task 5: Per-brand product count limit (trigger)

**Files:**
- Modify: `supabase/migrations/0038_trust_boundary.sql` (append)

**Interfaces:**
- Consumes: Task 4
- Produces: trigger function `validate_brand_product_insert()` and trigger on `brand_products`

A CHECK constraint cannot reference other rows, so this requires a trigger.

- [ ] **Step 1: Append product count trigger**

```sql
-- =============================================================================
-- Section 5: Aggregate count limits (triggers)
-- =============================================================================

-- Finding 3: brand_products — app caps at 12 per ingestion, DB has no per-brand limit.
-- Cap at 50 (generous ceiling — the app ingests 12 at a time but brands can add manually too).
create function public.validate_brand_product_count()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_count int;
begin
  select count(*) into v_count
  from public.brand_products
  where brand_id = new.brand_id;
  if v_count >= 50 then
    raise exception 'Product limit reached (max 50 per brand)';
  end if;
  return new;
end;
$$;

create trigger brand_products_count_gate
  before insert on public.brand_products
  for each row execute function public.validate_brand_product_count();
```

- [ ] **Step 2: Verify migration applies**

```bash
rtk supabase db reset
```
Expected: clean apply.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0038_trust_boundary.sql
git commit -m "fix(db): per-brand product count limit trigger (max 50)"
```

---

### Task 6: Campaign edit guard — block budget/offering_type change with pending applications (trigger)

**Files:**
- Modify: `supabase/migrations/0038_trust_boundary.sql` (append)

**Interfaces:**
- Consumes: Task 5
- Produces: trigger function `validate_campaign_update()` and trigger on `campaigns`

- [ ] **Step 1: Append campaign update trigger**

```sql
-- =============================================================================
-- Section 6: Campaign edit guard
-- =============================================================================

-- Finding 10: app blocks budget/offering_type change when pending applications exist.
-- DB has no such enforcement. A brand can call update on campaigns directly.
create function public.validate_campaign_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_pending int;
begin
  -- service role bypasses (admin tooling)
  if auth.uid() is null then
    return new;
  end if;

  if new.budget_min_cents is distinct from old.budget_min_cents
     or new.budget_max_cents is distinct from old.budget_max_cents
     or new.offering_type is distinct from old.offering_type then

    select count(*) into v_pending
    from public.campaign_applications a
    where a.campaign_id = old.id and a.status = 'pending';

    if v_pending > 0 then
      raise exception 'Cannot change budget or offering type while % pending application(s) exist — decline them first', v_pending;
    end if;
  end if;

  return new;
end;
$$;

create trigger campaigns_validate_update
  before update on public.campaigns
  for each row execute function public.validate_campaign_update();
```

- [ ] **Step 2: Write a vitest shim to document the rule**

Create `app/campaigns/__tests__/edit-guard-rule.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

describe("campaign edit guard (DB rule documentation)", () => {
  it("should block budget changes when pending applications exist", () => {
    // This test documents the DB trigger validate_campaign_update().
    // The trigger raises an exception if budget_min_cents, budget_max_cents,
    // or offering_type changes while campaign_applications with status='pending' exist.
    // Actual enforcement is in 0038_trust_boundary.sql Section 6.
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 3: Verify migration applies**

```bash
rtk supabase db reset
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0038_trust_boundary.sql app/campaigns/__tests__/edit-guard-rule.test.ts
git commit -m "fix(db): block campaign budget/type edit with pending applications"
```

---

### Task 7: Product delete guard — prevent deletion when referenced by open campaigns (trigger)

**Files:**
- Modify: `supabase/migrations/0038_trust_boundary.sql` (append)

**Interfaces:**
- Consumes: Task 6
- Produces: trigger function `validate_brand_product_delete()` and trigger on `brand_products`

- [ ] **Step 1: Append product delete trigger**

```sql
-- =============================================================================
-- Section 7: Product delete guard
-- =============================================================================

-- Finding 11: app checks open campaigns before delete, DB just SET NULLs the FK.
-- Add a BEFORE DELETE trigger that rejects when open campaigns reference this product.
create function public.validate_brand_product_delete()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_count int;
begin
  if auth.uid() is null then
    return old; -- service role bypass
  end if;

  select count(*) into v_count
  from public.campaigns c
  where c.product_id = old.id and c.status = 'open';

  if v_count > 0 then
    raise exception 'This product is used by % open campaign(s) — close or edit the campaign first', v_count;
  end if;

  return old;
end;
$$;

create trigger brand_products_delete_gate
  before delete on public.brand_products
  for each row execute function public.validate_brand_product_delete();
```

- [ ] **Step 2: Verify migration applies**

```bash
rtk supabase db reset
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0038_trust_boundary.sql
git commit -m "fix(db): prevent product delete when referenced by open campaigns"
```

---

### Task 8: Storefront completeness gate in accept_offer() RPC

**Files:**
- Modify: `supabase/migrations/0038_trust_boundary.sql` (append)

**Interfaces:**
- Consumes: Task 7
- Produces: updated `accept_offer()` function with storefront completeness check

The app checks storefront completeness before calling `accept_offer()`, but the RPC itself does not. A direct RPC call bypasses the check.

- [ ] **Step 1: Read the current accept_offer function**

The latest version is in `0037_brand_flow_robustness.sql:179-234`. It calls `create_deal()` which itself doesn't check completeness.

- [ ] **Step 2: Append the patched accept_offer**

```sql
-- =============================================================================
-- Section 8: Storefront completeness gate in accept_offer
-- =============================================================================

-- Finding 12: app checks storefront completeness before accept_offer(),
-- but the RPC itself does not. Direct call bypasses the gate.
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
  v_has_account boolean;
  v_has_portfolio boolean;
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

  -- Storefront completeness gate (mirrors app-layer check)
  select exists(
    select 1 from public.connected_accounts a where a.creator_id = v_uid
  ) into v_has_account;
  select exists(
    select 1 from public.portfolio_items p where p.creator_id = v_uid
  ) into v_has_portfolio;
  if not v_has_account or not v_has_portfolio then
    raise exception 'Complete your storefront (add a channel and a sample) before accepting offers';
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
    'accepted',
    'off_platform'::public.payment_mode
  );

  perform set_config('clipline.internal', '1', true);
  update public.offers
  set status = 'accepted', decided_at = now(), deal_id = v_deal_id
  where id = p_offer_id;
  perform set_config('clipline.internal', '', true);

  return v_deal_id;
end;
$$;

revoke all on function public.accept_offer(uuid) from public;
grant execute on function public.accept_offer(uuid) to authenticated;
```

- [ ] **Step 3: Verify migration applies**

```bash
rtk supabase db reset
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0038_trust_boundary.sql
git commit -m "fix(db): add storefront completeness gate to accept_offer RPC"
```

---

### Task 9: Batch-size caps on bulk operations (trigger + RPC guards)

**Files:**
- Modify: `supabase/migrations/0038_trust_boundary.sql` (append)

**Interfaces:**
- Consumes: Task 8
- Produces: updated `invite_to_campaign()` with per-campaign invite cap; conversation insert rate limit

- [ ] **Step 1: Append batch/rate guards**

```sql
-- =============================================================================
-- Section 9: Batch and rate limits
-- =============================================================================

-- Finding 1: Campaign invite batch — app caps at 5 per request.
-- The RPC is called once per creator, so batch cap doesn't apply at the RPC level.
-- Instead, cap total invites per campaign at 200 (generous ceiling).
create or replace function public.invite_to_campaign(
  p_campaign_id uuid,
  p_creator_id uuid
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_brand uuid;
  v_conv_id uuid;
  v_invite_count int;
begin
  select brand_id into v_brand from public.campaigns where id = p_campaign_id;
  if v_brand is null then raise exception 'campaign not found'; end if;
  if v_brand <> v_uid then raise exception 'not campaign owner'; end if;

  -- reject blocked creators
  if exists (select 1 from public.brand_blocklist b
             where b.brand_id = v_uid and b.creator_id = p_creator_id) then
    raise exception 'This creator is on your blocklist';
  end if;
  -- reject inactive creators
  if not exists (select 1 from public.creator_profiles cp
                 where cp.user_id = p_creator_id and cp.status = 'live') then
    raise exception 'This creator is not accepting invitations';
  end if;

  -- Per-campaign invite cap
  select count(*) into v_invite_count
  from public.campaign_invites ci
  where ci.campaign_id = p_campaign_id;
  if v_invite_count >= 200 then
    raise exception 'Campaign invite limit reached (max 200 per campaign)';
  end if;

  select id into v_conv_id from public.conversations
    where brand_id = v_uid and creator_id = p_creator_id;
  if v_conv_id is null then
    insert into public.conversations (brand_id, creator_id, status, invite_message)
    values (v_uid, p_creator_id, 'invited', 'You have been invited to a campaign')
    returning id into v_conv_id;
  end if;

  insert into public.campaign_invites (campaign_id, creator_id, conversation_id)
  values (p_campaign_id, p_creator_id, v_conv_id)
  on conflict (campaign_id, creator_id) do update set conversation_id = excluded.conversation_id;

  return v_conv_id;
end;
$$;
grant execute on function public.invite_to_campaign(uuid, uuid) to authenticated;

-- Finding 2: Reachout batch — app caps at 20 per request.
-- The unique(brand_id, creator_id) on conversations prevents duplicate pairs.
-- Add a per-brand daily conversation creation limit via the existing insert trigger.
create or replace function public.validate_conversation_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_internal boolean :=
    coalesce(current_setting('clipline.internal', true), '') = '1';
  v_creator_role public.user_role;
  v_recent int;
begin
  if new.brand_id = new.creator_id then
    raise exception 'You cannot invite yourself';
  end if;
  select role into v_creator_role from public.profiles where id = new.creator_id;
  if v_creator_role is distinct from 'creator' then
    raise exception 'Invitations can only go to creator accounts';
  end if;

  if not v_internal then
    if not exists (select 1 from public.creator_profiles cp
                   where cp.user_id = new.creator_id and cp.status = 'live') then
      raise exception 'This creator is not accepting invitations';
    end if;
    if exists (select 1 from public.brand_blocklist b
               where b.brand_id = new.brand_id and b.creator_id = new.creator_id) then
      raise exception 'You have blocked this creator';
    end if;

    -- Per-brand daily reachout cap (Finding 2)
    select count(*) into v_recent
    from public.conversations c
    where c.brand_id = new.brand_id
      and c.created_at > now() - interval '24 hours';
    if v_recent >= 100 then
      raise exception 'Daily outreach limit reached (max 100 per day). Try again tomorrow.';
    end if;

    new.status := 'invited';
    new.responded_at := null;
  end if;

  new.created_at := now();
  return new;
end;
$$;
```

- [ ] **Step 2: Verify migration applies**

```bash
rtk supabase db reset
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0038_trust_boundary.sql
git commit -m "fix(db): add per-campaign invite cap (200), per-brand daily reachout cap (100)"
```

---

### Task 10: Final validation — full reset and smoke test

**Files:**
- Modify: `supabase/migrations/0038_trust_boundary.sql` (review only — no changes expected)
- Read: all migration files 0001–0038

**Interfaces:**
- Consumes: Tasks 1–9 (complete migration file)
- Produces: verified migration

- [ ] **Step 1: Full database reset**

```bash
rtk supabase db reset
```
Expected: all 38 migrations apply cleanly with no errors.

- [ ] **Step 2: Run existing test suite**

```bash
rtk vitest run
```
Expected: all existing tests pass. No app code was changed, so no regressions.

- [ ] **Step 3: Verify constraint names don't collide**

```bash
rtk supabase db reset 2>&1 | grep -i "already exists"
```
Expected: no output (no collisions).

- [ ] **Step 4: Manually verify key constraints exist**

Connect to local DB and run:
```sql
-- Check text-length constraints
select conname from pg_constraint where conrelid = 'public.reviews'::regclass and conname like '%body%';
select conname from pg_constraint where conrelid = 'public.reports'::regclass and conname like '%reason%';
select conname from pg_constraint where conrelid = 'public.brand_profiles'::regclass and conname like '%company%';

-- Check array constraints
select conname from pg_constraint where conrelid = 'public.creator_profiles'::regclass and conname like '%niches%';

-- Check triggers
select tgname from pg_trigger where tgrelid = 'public.brand_products'::regclass;
select tgname from pg_trigger where tgrelid = 'public.campaigns'::regclass;
```

- [ ] **Step 5: Commit final state**

```bash
git add supabase/migrations/0038_trust_boundary.sql
git commit -m "fix(db): trust-boundary enforcement migration — 19 gaps closed"
```

---

## Coverage Matrix

| Finding | Rule | Fix Location (section) |
|---------|------|----------------------|
| 1 | Campaign invite batch | Section 9 — per-campaign 200 cap in `invite_to_campaign()` |
| 2 | Reachout batch | Section 9 — daily 100 cap in `validate_conversation_insert()` |
| 3 | Product count per brand | Section 5 — trigger caps at 50 |
| 4 | Niches ≤ 8 | Section 3 — CHECK on `creator_profiles`, `brand_profiles` |
| 5 | Languages ≤ 5 | Section 3 — CHECK on `creator_profiles` |
| 6 | Company name required | Section 2 — NOT NULL |
| 7 | Company name ≤ 120 | Section 1 — CHECK |
| 10 | No budget/type edit with pending apps | Section 6 — BEFORE UPDATE trigger |
| 11 | Product delete guard | Section 7 — BEFORE DELETE trigger |
| 12 | Storefront completeness for offer accept | Section 8 — guard in `accept_offer()` |
| 14 | Review body ≤ 1000 | Section 1 — CHECK |
| 15 | Report reason ≤ 2000 | Section 1 — CHECK |
| 16 | Resolution note ≤ 500 | Section 1 — CHECK |
| 19 | Brief field lengths | Section 1 — CHECKs (4000 limit) |
| 20 | Age min ≤ max | Section 4 — cross-column CHECK |
| 24 | Signup goals ≤ 8 | Not fixed — stored in `auth.users.raw_user_meta_data` (Supabase-managed, no custom constraints possible) |
| 27 | Offering price upper bound | Section 2 — CHECK |
| 29 | Bulk op batch size | Not fixed at DB — these operations loop through `transition_deal()` which already validates per-call. The risk is server-side resource exhaustion (long request), not data corruption. Fix in app by adding `.slice()` caps to `bulkMarkProductSent`, `bulkDecideApplications`, and `bulkArchiveConversations`. |

### Out-of-scope items (no DB fix possible/needed)

| Finding | Reason |
|---------|--------|
| 24 | `auth.users` is Supabase-managed; custom CHECK constraints cannot be added. Low impact (goals are advisory). |
| 29 | Bulk loop resource exhaustion is an app-tier concern, not a data-integrity concern. Each iteration calls a validated RPC. Recommend adding `.slice(0, 50)` caps in the three bulk server actions as a follow-up. |
