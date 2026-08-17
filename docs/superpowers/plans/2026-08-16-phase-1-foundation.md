# Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the marketplace app with auth + roles, the complete database schema with RLS, and the DB-enforced deal state machine — the substrate every later phase builds on.

**Architecture:** Next.js App Router (TypeScript) on Vercel + Supabase (Postgres/Auth/RLS). The deal state machine is defined once in TypeScript (`lib/deals/machine.ts`) and a checked-in generator emits the SQL seed for a `deal_transitions` reference table; a single `transition_deal()` security-definer function validates every status change against that table (spec ADR-004).

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind, @supabase/ssr, Supabase CLI (migrations), Vitest.

**Spec:** `docs/superpowers/specs/2026-08-16-video-micro-influencer-marketplace-design.md`

## Global Constraints

- All tables have RLS enabled — no exceptions (spec: Security).
- Deal status changes ONLY via `transition_deal()`; direct `UPDATE deals SET status` must be impossible for app roles (spec ADR-004).
- Money columns are `*_cents bigint` + `currency text default 'usd'` — never floats.
- OAuth tokens never stored in queryable columns — `token_ref` holds a Supabase Vault secret id only (spec: Data model). Vault usage itself lands in Phase 5.
- Enum values exactly as specced: roles `creator|brand|admin`; platforms `youtube|tiktok|instagram`; offering types `dedicated_video|integration|short_form_post|ugc_video`; payment modes `escrow|off_platform`.
- Deal statuses exactly: `requested|funded|accepted|in_production|submitted|revision_requested|published|completed|cancelled|disputed`.
- Commit after every task (green tests only).
- Supabase workflow: migrations live in `supabase/migrations/`; apply with `supabase db push` (hosted project linked via `supabase link`). Local `supabase start` (Docker) is optional but preferred for testing.

---

### Task 1: Next.js scaffold + Vitest

**Files:**
- Create: Next.js app at repo root (`create-next-app`), `vitest.config.ts`, `.env.local.example`
- Test: `lib/__tests__/smoke.test.ts`

**Interfaces:**
- Produces: repo layout — `app/`, `lib/`, `supabase/` (Task 2+); `npm test` runs Vitest.

- [ ] **Step 1: Scaffold the app**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias "@/*" --use-npm --yes
npm install -D vitest @vitest/coverage-v8
npm install @supabase/supabase-js @supabase/ssr
```

(Repo already contains `docs/` and `.impeccable/`; create-next-app tolerates non-conflicting existing files. If it refuses, scaffold into `tmp-app/` and move contents up: `Get-ChildItem tmp-app -Force | Move-Item -Destination .` then remove `tmp-app`.)

- [ ] **Step 2: Add Vitest config and npm script**

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  test: { include: ["**/__tests__/**/*.test.ts"], environment: "node" },
});
```

In `package.json` scripts add: `"test": "vitest run"`.

- [ ] **Step 3: Write smoke test**

`lib/__tests__/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("toolchain", () => {
  it("runs tests", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 4: Verify**

Run: `npm test` → PASS (1 test). Run: `npm run build` → compiles.

- [ ] **Step 5: Create `.env.local.example`**

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js app with Vitest toolchain"
```

---

### Task 2: Supabase project + client helpers

**Files:**
- Create: `supabase/` (via `supabase init`), `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts`, `proxy.ts` (Next.js 16 renamed root middleware.ts → proxy.ts; human-approved plan amendment)

**Interfaces:**
- Produces: `createClient()` (browser), `createServerSupabase()` (RSC/server actions, cookie-bound), used by every later task.

- [ ] **Step 1: Init and link Supabase**

```bash
supabase init
supabase link --project-ref <PROJECT_REF>
```

USER ACTION REQUIRED: create a Supabase project at database.new if none exists; put its URL + anon key + service-role key in `.env.local`.

- [ ] **Step 2: Browser client**

`lib/supabase/client.ts`:
```ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 3: Server client**

`lib/supabase/server.ts`:
```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (all) => {
          try {
            all.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // called from a Server Component — middleware refreshes sessions
          }
        },
      },
    }
  );
}
```

- [ ] **Step 4: Session-refresh middleware**

`lib/supabase/middleware.ts`:
```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (all) => {
          all.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          all.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );
  await supabase.auth.getUser(); // refreshes expired tokens
  return response;
}
```

`middleware.ts` (repo root):
```ts
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

- [ ] **Step 5: Verify** — `npm run build` compiles; `npm run dev` serves the default page with middleware active (no errors in console).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add Supabase clients and session middleware"
```

---

### Task 3: Migration 1 — profiles, roles, signup trigger

**Files:**
- Create: `supabase/migrations/0001_profiles.sql`

**Interfaces:**
- Produces: `public.profiles(id, role, display_name, avatar_url)`, `public.creator_profiles(user_id, handle, …, status)`, `public.brand_profiles(user_id, company, …)`; `user_role` enum. Signup metadata key `role` ('creator'|'brand') controls the created profile's role.

- [ ] **Step 1: Write the migration**

`supabase/migrations/0001_profiles.sql`:
```sql
create extension if not exists citext;

create type public.user_role as enum ('creator','brand','admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'brand',
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "profiles are publicly readable"
  on public.profiles for select using (true);
create policy "users update own profile"
  on public.profiles for update using ((select auth.uid()) = id);

create table public.creator_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  handle citext unique not null check (handle ~ '^[a-z0-9_]{3,30}$'),
  bio text,
  niches text[] not null default '{}',
  country text,
  languages text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft','live','suspended')),
  created_at timestamptz not null default now()
);
alter table public.creator_profiles enable row level security;

create policy "live creator profiles are public, owners see own"
  on public.creator_profiles for select
  using (status = 'live' or (select auth.uid()) = user_id);
create policy "creators insert own"
  on public.creator_profiles for insert with check ((select auth.uid()) = user_id);
create policy "creators update own"
  on public.creator_profiles for update using ((select auth.uid()) = user_id);

create table public.brand_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  company text,
  website text,
  logo_url text,
  created_at timestamptz not null default now()
);
alter table public.brand_profiles enable row level security;

create policy "brand profiles readable by authenticated"
  on public.brand_profiles for select to authenticated using (true);
create policy "brands insert own"
  on public.brand_profiles for insert with check ((select auth.uid()) = user_id);
create policy "brands update own"
  on public.brand_profiles for update using ((select auth.uid()) = user_id);

-- auto-create profile row on signup; role comes from signup metadata
create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, role, display_name)
  values (
    new.id,
    -- SECURITY (human-approved amendment): only creator/brand accepted from
    -- client metadata; 'admin' can never be self-assigned at signup
    case new.raw_user_meta_data->>'role'
      when 'creator' then 'creator'::public.user_role
      else 'brand'::public.user_role
    end,
    new.raw_user_meta_data->>'display_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- SECURITY (human-approved amendment): privileged-column lockdown —
-- users cannot update their own role; suspension is admin-only territory
revoke update on table public.profiles from anon, authenticated;
grant update (display_name, avatar_url) on table public.profiles to authenticated;

create function public.enforce_creator_status_rules()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and (old.status = 'suspended' or new.status = 'suspended')
     and auth.uid() is not null
     and not exists (
       select 1 from public.profiles p
       where p.id = auth.uid() and p.role = 'admin'
     ) then
    raise exception 'only admins can change suspension status';
  end if;
  return new;
end;
$$;

create trigger creator_status_guard
  before update on public.creator_profiles
  for each row execute function public.enforce_creator_status_rules();

-- explicit app-role grants (environment amendment: this stack's default ACL
-- gives app roles no DML on new tables; each table states its access).
grant select on table public.profiles to anon, authenticated;
grant select on table public.creator_profiles to anon, authenticated;
grant insert, update on table public.creator_profiles to authenticated;
grant select, insert, update on table public.brand_profiles to authenticated;
grant select, insert, update, delete on table public.profiles to service_role;
grant select, insert, update, delete on table public.creator_profiles to service_role;
grant select, insert, update, delete on table public.brand_profiles to service_role;
```

- [ ] **Step 2: Apply** — Run: `supabase db push`. Expected: migration applied, no errors.

- [ ] **Step 3: Verify trigger** — In Supabase Studio SQL editor:
```sql
select count(*) from pg_trigger where tgname = 'on_auth_user_created';
```
Expected: 1.

- [ ] **Step 4: Commit**

```bash
git add supabase
git commit -m "feat: profiles schema with roles, RLS, and signup trigger"
```

---

### Task 4: Migration 2 — offerings, portfolio, connected accounts

**Files:**
- Create: `supabase/migrations/0002_catalog.sql`

**Interfaces:**
- Produces: `offerings`, `portfolio_items`, `connected_accounts` tables; `platform` + `offering_type` enums; `public_creator_stats` view (safe public stat columns — Phase 2 storefront reads this).

- [ ] **Step 1: Write the migration**

`supabase/migrations/0002_catalog.sql`:
```sql
create type public.platform as enum ('youtube','tiktok','instagram');
create type public.offering_type as enum
  ('dedicated_video','integration','short_form_post','ugc_video');

create table public.offerings (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles(user_id) on delete cascade,
  type public.offering_type not null,
  title text not null,
  description text,
  price_cents bigint not null check (price_cents > 0),
  currency text not null default 'usd',
  turnaround_days int not null default 14 check (turnaround_days between 1 and 90),
  revision_limit int not null default 1 check (revision_limit between 0 and 5),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.offerings enable row level security;
create index offerings_creator_idx on public.offerings (creator_id);

create policy "active offerings public, owners see own"
  on public.offerings for select
  using (active = true or (select auth.uid()) = creator_id);
create policy "creators manage own offerings"
  on public.offerings for all
  using ((select auth.uid()) = creator_id)
  with check ((select auth.uid()) = creator_id);

create table public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles(user_id) on delete cascade,
  media_url text not null,
  caption text,
  created_at timestamptz not null default now()
);
alter table public.portfolio_items enable row level security;
create index portfolio_creator_idx on public.portfolio_items (creator_id);

create policy "portfolio public"
  on public.portfolio_items for select using (true);
create policy "creators manage own portfolio"
  on public.portfolio_items for all
  using ((select auth.uid()) = creator_id)
  with check ((select auth.uid()) = creator_id);

create table public.connected_accounts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles(user_id) on delete cascade,
  platform public.platform not null,
  platform_handle text not null,
  token_ref uuid, -- Supabase Vault secret id; never the token itself
  follower_count bigint,
  avg_views bigint,
  engagement_rate numeric(5,2),
  verification_status text not null default 'pending'
    check (verification_status in ('verified','pending','stale','failed')),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (creator_id, platform)
);
alter table public.connected_accounts enable row level security;

-- owner-only on the base table: token_ref must not be publicly readable
create policy "creators manage own connected accounts"
  on public.connected_accounts for all
  using ((select auth.uid()) = creator_id)
  with check ((select auth.uid()) = creator_id);

-- privileged-column lockdown (human-approved amendment): only service-role
-- sync jobs may create/update connected accounts; owners keep select (RLS)
-- and delete (disconnect). Prevents self-certified "verified" badges/stats.
revoke insert, update on table public.connected_accounts from anon, authenticated;

-- public stats surface WITHOUT token_ref (definer view bypasses base RLS deliberately)
create view public.public_creator_stats
  with (security_invoker = off) as
  select ca.creator_id, ca.platform, ca.platform_handle,
         ca.follower_count, ca.avg_views, ca.engagement_rate,
         ca.verification_status, ca.last_synced_at
  from public.connected_accounts ca
  join public.creator_profiles cp on cp.user_id = ca.creator_id
  where cp.status = 'live';
grant select on public.public_creator_stats to anon, authenticated;

-- explicit app-role grants (see 0001 note): default ACL grants app roles no DML
grant select on table public.offerings to anon, authenticated;
grant insert, update, delete on table public.offerings to authenticated;
grant select on table public.portfolio_items to anon, authenticated;
grant insert, update, delete on table public.portfolio_items to authenticated;
grant select, delete on table public.connected_accounts to authenticated;
grant select, insert, update, delete on table public.offerings to service_role;
grant select, insert, update, delete on table public.portfolio_items to service_role;
grant select, insert, update, delete on table public.connected_accounts to service_role;
```

- [ ] **Step 2: Apply** — Run: `supabase db push`. Expected: applied cleanly.

- [ ] **Step 3: Verify view hides tokens** — Studio SQL:
```sql
select column_name from information_schema.columns
where table_name = 'public_creator_stats' and column_name = 'token_ref';
```
Expected: 0 rows.

- [ ] **Step 4: Commit**

```bash
git add supabase
git commit -m "feat: offerings, portfolio, connected accounts schema with public stats view"
```

---

### Task 5: Migration 3 — deals domain tables

**Files:**
- Create: `supabase/migrations/0003_deals.sql`

**Interfaces:**
- Produces: `deals` (status changes locked — no UPDATE policy on status path; all writes via Task 7's RPC), `briefs`, `deal_events`, `messages`, `payments`, `payouts`, `stripe_events`, `reviews`, `reports`; enums `deal_status`, `payment_mode`.

- [ ] **Step 1: Write the migration**

`supabase/migrations/0003_deals.sql`:
```sql
create type public.deal_status as enum
  ('requested','funded','accepted','in_production','submitted',
   'revision_requested','published','completed','cancelled','disputed');
create type public.payment_mode as enum ('escrow','off_platform');

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.profiles(id),
  creator_id uuid not null references public.creator_profiles(user_id),
  offering_id uuid references public.offerings(id) on delete set null,
  -- offering snapshot, frozen at booking
  offering_type public.offering_type not null,
  offering_title text not null,
  price_cents bigint not null,
  currency text not null default 'usd',
  revision_limit int not null default 1,
  -- state
  status public.deal_status not null default 'requested',
  payment_mode public.payment_mode not null,
  revision_count int not null default 0,
  live_url text,
  preview_url text,
  marked_paid_at timestamptz, -- off_platform bookkeeping only
  due_date date,
  requested_at timestamptz not null default now(),
  funded_at timestamptz,
  accepted_at timestamptz,
  submitted_at timestamptz,
  published_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz
);
alter table public.deals enable row level security;
create index deals_creator_idx on public.deals (creator_id, status);
create index deals_brand_idx on public.deals (brand_id, status);

create policy "participants read own deals"
  on public.deals for select
  using ((select auth.uid()) in (brand_id, creator_id));
create policy "brands create deals as requested"
  on public.deals for insert
  with check ((select auth.uid()) = brand_id and status = 'requested');
-- NO update/delete policies: every mutation goes through security-definer RPCs.

-- deal-creation integrity (human-approved amendment): snapshot is forced from
-- the referenced offering, self-dealing is rejected, only brands can book
create function public.validate_deal_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_offering public.offerings;
  v_brand_role public.user_role;
begin
  if new.brand_id = new.creator_id then
    raise exception 'brand and creator cannot be the same user';
  end if;

  select role into v_brand_role from public.profiles where id = new.brand_id;
  if v_brand_role is distinct from 'brand' then
    raise exception 'deals can only be created by brand accounts';
  end if;

  if new.offering_id is null then
    raise exception 'deals must reference an offering';
  end if;

  select * into v_offering from public.offerings o where o.id = new.offering_id;
  if not found or not v_offering.active then
    raise exception 'offering not found or inactive';
  end if;
  if v_offering.creator_id <> new.creator_id then
    raise exception 'offering does not belong to this creator';
  end if;

  -- snapshot integrity: frozen values always come from the offering itself
  new.offering_type := v_offering.type;
  new.offering_title := v_offering.title;
  new.price_cents := v_offering.price_cents;
  new.currency := v_offering.currency;
  new.revision_limit := v_offering.revision_limit;

  return new;
end;
$$;

create trigger deals_validate_insert
  before insert on public.deals
  for each row execute function public.validate_deal_insert();

create table public.briefs (
  deal_id uuid primary key references public.deals(id) on delete cascade,
  goals text,
  product_description text,
  talking_points text,
  links text[] not null default '{}',
  asset_paths text[] not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.briefs enable row level security;
create policy "participants read brief" on public.briefs for select
  using (exists (select 1 from public.deals d
                 where d.id = deal_id and (select auth.uid()) in (d.brand_id, d.creator_id)));
create policy "brand writes brief" on public.briefs for insert
  with check (exists (select 1 from public.deals d
                      where d.id = deal_id and (select auth.uid()) = d.brand_id));

create table public.deal_events (
  id bigint generated always as identity primary key,
  deal_id uuid not null references public.deals(id) on delete cascade,
  actor uuid,
  action text not null,
  from_status public.deal_status,
  to_status public.deal_status,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.deal_events enable row level security;
create index deal_events_deal_idx on public.deal_events (deal_id);
create policy "participants read deal events" on public.deal_events for select
  using (exists (select 1 from public.deals d
                 where d.id = deal_id and (select auth.uid()) in (d.brand_id, d.creator_id)));
-- inserts only via security-definer functions

create table public.messages (
  id bigint generated always as identity primary key,
  deal_id uuid not null references public.deals(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  body text not null check (length(body) between 1 and 5000),
  attachment_paths text[] not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.messages enable row level security;
create index messages_deal_idx on public.messages (deal_id);
create policy "participants read messages" on public.messages for select
  using (exists (select 1 from public.deals d
                 where d.id = deal_id and (select auth.uid()) in (d.brand_id, d.creator_id)));
create policy "participants send messages" on public.messages for insert
  with check ((select auth.uid()) = sender_id
    and exists (select 1 from public.deals d
                where d.id = deal_id and (select auth.uid()) in (d.brand_id, d.creator_id)));

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id),
  stripe_payment_intent_id text unique,
  amount_cents bigint not null,
  currency text not null default 'usd',
  status text not null default 'pending'
    check (status in ('pending','succeeded','refunded','failed')),
  created_at timestamptz not null default now()
);
alter table public.payments enable row level security;
create policy "participants read payments" on public.payments for select
  using (exists (select 1 from public.deals d
                 where d.id = deal_id and (select auth.uid()) in (d.brand_id, d.creator_id)));

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id),
  stripe_transfer_id text unique,
  amount_cents bigint not null,
  currency text not null default 'usd',
  status text not null default 'pending'
    check (status in ('pending','paid','failed')),
  created_at timestamptz not null default now()
);
alter table public.payouts enable row level security;
create policy "creator reads own payouts" on public.payouts for select
  using (exists (select 1 from public.deals d
                 where d.id = deal_id and (select auth.uid()) = d.creator_id));

create table public.stripe_events (
  event_id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;
-- service-role only; no policies

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id),
  author_id uuid not null references public.profiles(id),
  rating int not null check (rating between 1 and 5),
  body text,
  created_at timestamptz not null default now(),
  unique (deal_id, author_id)
);
alter table public.reviews enable row level security;
create policy "reviews are public" on public.reviews for select using (true);
create policy "participants review completed deals" on public.reviews for insert
  with check ((select auth.uid()) = author_id
    and exists (select 1 from public.deals d
                where d.id = deal_id and d.status = 'completed'
                  and (select auth.uid()) in (d.brand_id, d.creator_id)));

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id),
  subject_user_id uuid references public.profiles(id),
  deal_id uuid references public.deals(id),
  reason text not null,
  resolution text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;
create policy "reporter reads own reports" on public.reports for select
  using ((select auth.uid()) = reporter_id);
create policy "authenticated users file reports" on public.reports for insert
  with check ((select auth.uid()) = reporter_id);

-- explicit app-role grants (environment amendment: this stack's default ACL
-- gives app roles no DML on new tables). RLS remains the row filter.
-- No update grant on deals to authenticated: all status changes go through
-- the security-definer transition_deal() RPC (Task 7).
grant select, insert on table public.deals to authenticated;
grant select, insert on table public.briefs to authenticated;
grant select on table public.deal_events to authenticated;
grant select, insert on table public.messages to authenticated;
grant select on table public.payments to authenticated;
grant select on table public.payouts to authenticated;
grant select on table public.reviews to anon, authenticated;
grant insert on table public.reviews to authenticated;
grant select, insert on table public.reports to authenticated;
grant select, insert, update, delete on table public.deals to service_role;
grant select, insert, update, delete on table public.briefs to service_role;
grant select, insert, update, delete on table public.deal_events to service_role;
grant select, insert, update, delete on table public.messages to service_role;
grant select, insert, update, delete on table public.payments to service_role;
grant select, insert, update, delete on table public.payouts to service_role;
grant select, insert, update, delete on table public.stripe_events to service_role;
grant select, insert, update, delete on table public.reviews to service_role;
grant select, insert, update, delete on table public.reports to service_role;
```

- [ ] **Step 2: Apply** — Run: `supabase db push`. Expected: applied cleanly.

- [ ] **Step 3: Verify status is locked** — Studio SQL as an authenticated test user (or `set role authenticated;` locally):
```sql
update public.deals set status = 'completed' where true;
```
Expected: 0 rows updated (no update policy exists).

- [ ] **Step 4: Commit**

```bash
git add supabase
git commit -m "feat: deals domain schema — deals, briefs, events, messages, payments, reviews"
```

---

### Task 6: Deal state machine in TypeScript (single source of truth)

**Files:**
- Create: `lib/deals/machine.ts`
- Test: `lib/deals/__tests__/machine.test.ts`

**Interfaces:**
- Produces:
  - `type DealStatus`, `type DealAction`, `type Actor = "brand" | "creator" | "system" | "admin"`, `type PaymentMode = "escrow" | "off_platform"`
  - `const TRANSITIONS: Transition[]` where `Transition = { from: DealStatus; action: DealAction; to: DealStatus; actor: Actor; mode: PaymentMode | null }` (`mode: null` = both modes)
  - `canTransition(from: DealStatus, action: DealAction, actor: Actor, mode: PaymentMode): Transition | undefined`
- Task 7 generates SQL from `TRANSITIONS`; Phase 4 UI uses `canTransition` for button affordances.

- [ ] **Step 1: Write failing tests**

`lib/deals/__tests__/machine.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { canTransition, TRANSITIONS } from "@/lib/deals/machine";

describe("deal state machine", () => {
  it("escrow: requested can only be funded (system), not accepted directly", () => {
    expect(canTransition("requested", "fund", "system", "escrow")).toBeTruthy();
    expect(canTransition("requested", "accept", "creator", "escrow")).toBeUndefined();
  });

  it("off_platform: creator accepts straight from requested; fund is illegal", () => {
    expect(canTransition("requested", "accept", "creator", "off_platform")).toBeTruthy();
    expect(canTransition("requested", "fund", "system", "off_platform")).toBeUndefined();
  });

  it("escrow: creator accepts from funded", () => {
    expect(canTransition("funded", "accept", "creator", "escrow")).toBeTruthy();
  });

  it("actor is enforced: brand cannot accept", () => {
    expect(canTransition("funded", "accept", "brand", "escrow")).toBeUndefined();
  });

  it("happy path reaches completed in both modes", () => {
    for (const mode of ["escrow", "off_platform"] as const) {
      let s: string =
        mode === "escrow"
          ? canTransition("requested", "fund", "system", mode)!.to
          : "requested";
      s = canTransition(s as any, "accept", "creator", mode)!.to;
      s = canTransition(s as any, "begin_production", "creator", mode)!.to;
      s = canTransition(s as any, "submit_preview", "creator", mode)!.to;
      s = canTransition(s as any, "mark_published", "creator", mode)!.to;
      s = canTransition(s as any, "approve", "brand", mode)!.to;
      expect(s).toBe("completed");
    }
  });

  it("revision loop: submitted -> revision_requested -> submitted", () => {
    expect(canTransition("submitted", "request_revision", "brand", "escrow")!.to)
      .toBe("revision_requested");
    expect(canTransition("revision_requested", "submit_preview", "creator", "escrow")!.to)
      .toBe("submitted");
  });

  it("timers: expire_accept cancels, auto_approve completes", () => {
    expect(canTransition("funded", "expire_accept", "system", "escrow")!.to).toBe("cancelled");
    expect(canTransition("requested", "expire_accept", "system", "off_platform")!.to).toBe("cancelled");
    expect(canTransition("published", "auto_approve", "system", "escrow")!.to).toBe("completed");
  });

  it("disputes: raisable mid-flight by either side, resolved only by admin", () => {
    expect(canTransition("in_production", "dispute", "brand", "escrow")).toBeTruthy();
    expect(canTransition("submitted", "dispute", "creator", "off_platform")).toBeTruthy();
    expect(canTransition("disputed", "resolve_release", "admin", "escrow")!.to).toBe("completed");
    expect(canTransition("disputed", "resolve_refund", "admin", "escrow")!.to).toBe("cancelled");
    expect(canTransition("disputed", "resolve_release", "brand", "escrow")).toBeUndefined();
  });

  it("terminal states have no outgoing transitions", () => {
    expect(TRANSITIONS.filter((t) => t.from === "completed" || t.from === "cancelled"))
      .toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npm test` → FAIL (module not found).

- [ ] **Step 3: Implement**

`lib/deals/machine.ts`:
```ts
export type DealStatus =
  | "requested" | "funded" | "accepted" | "in_production" | "submitted"
  | "revision_requested" | "published" | "completed" | "cancelled" | "disputed";

export type DealAction =
  | "fund" | "accept" | "decline" | "expire_accept" | "begin_production"
  | "submit_preview" | "request_revision" | "mark_published" | "approve"
  | "auto_approve" | "cancel" | "dispute" | "resolve_release" | "resolve_refund";

export type Actor = "brand" | "creator" | "system" | "admin";
export type PaymentMode = "escrow" | "off_platform";

export interface Transition {
  from: DealStatus;
  action: DealAction;
  to: DealStatus;
  actor: Actor;
  /** null = allowed in both payment modes */
  mode: PaymentMode | null;
}

const DISPUTABLE: DealStatus[] = [
  "accepted", "in_production", "submitted", "revision_requested", "published",
];

export const TRANSITIONS: Transition[] = [
  // funding gate (escrow only; Stripe webhook is the caller)
  { from: "requested", action: "fund", to: "funded", actor: "system", mode: "escrow" },

  // creator acceptance — entry state differs by mode
  { from: "funded", action: "accept", to: "accepted", actor: "creator", mode: "escrow" },
  { from: "requested", action: "accept", to: "accepted", actor: "creator", mode: "off_platform" },
  { from: "funded", action: "decline", to: "cancelled", actor: "creator", mode: "escrow" },
  { from: "requested", action: "decline", to: "cancelled", actor: "creator", mode: "off_platform" },

  // 72h accept deadline (worker)
  { from: "funded", action: "expire_accept", to: "cancelled", actor: "system", mode: "escrow" },
  { from: "requested", action: "expire_accept", to: "cancelled", actor: "system", mode: null },

  // production flow
  { from: "accepted", action: "begin_production", to: "in_production", actor: "creator", mode: null },
  { from: "in_production", action: "submit_preview", to: "submitted", actor: "creator", mode: null },
  { from: "revision_requested", action: "submit_preview", to: "submitted", actor: "creator", mode: null },
  { from: "submitted", action: "request_revision", to: "revision_requested", actor: "brand", mode: null },
  { from: "submitted", action: "mark_published", to: "published", actor: "creator", mode: null },

  // completion — brand approval or 5-day auto-approve (worker)
  { from: "published", action: "approve", to: "completed", actor: "brand", mode: null },
  { from: "published", action: "auto_approve", to: "completed", actor: "system", mode: null },

  // cancellation before submission (either side; refund handled by payments layer)
  // human ruling: brand may cancel through in_production; after submission, dispute-only
  { from: "requested", action: "cancel", to: "cancelled", actor: "brand", mode: null },
  { from: "funded", action: "cancel", to: "cancelled", actor: "brand", mode: "escrow" },
  { from: "accepted", action: "cancel", to: "cancelled", actor: "brand", mode: null },
  { from: "accepted", action: "cancel", to: "cancelled", actor: "creator", mode: null },
  { from: "in_production", action: "cancel", to: "cancelled", actor: "creator", mode: null },
  { from: "in_production", action: "cancel", to: "cancelled", actor: "brand", mode: null },

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

- [ ] **Step 4: Run tests** — `npm test` → all PASS.

- [ ] **Step 5: Commit**

```bash
git add -A lib
git commit -m "feat: deal state machine transition table with mode and actor guards"
```

---

### Task 7: Generated SQL enforcement — `deal_transitions` table + `transition_deal()`

**Files:**
- Create: `scripts/generate-transitions-sql.ts`, `supabase/migrations/0004_transitions.sql` (function + table), `supabase/migrations/0005_transitions_seed.sql` (GENERATED — do not hand-edit)
- Test: `lib/deals/__tests__/generate-sql.test.ts`

**Interfaces:**
- Consumes: `TRANSITIONS` from `lib/deals/machine.ts` (Task 6).
- Produces: RPC `transition_deal(p_deal_id uuid, p_action text, p_actor_role text) returns deals` — the ONLY way any code changes deal status. Callers: server actions (Phase 4), timer sweeps (Phase 4), webhook worker (Phase 4), admin (Phase 6). Also npm script `"gen:transitions": "tsx scripts/generate-transitions-sql.ts"`.

- [ ] **Step 1: Write failing generator test**

`lib/deals/__tests__/generate-sql.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { generateSeedSql } from "@/scripts/generate-transitions-sql";
import { TRANSITIONS } from "@/lib/deals/machine";

describe("transition SQL generator", () => {
  it("emits one insert row per transition", () => {
    const sql = generateSeedSql();
    const rows = sql.match(/\('\w+',\s*'\w+',\s*'\w+',\s*'\w+',\s*(null|'\w+')\)/g) ?? [];
    expect(rows).toHaveLength(TRANSITIONS.length);
  });

  it("truncates before seeding so regeneration is idempotent", () => {
    expect(generateSeedSql()).toContain("truncate table public.deal_transitions");
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npm test` → FAIL.

- [ ] **Step 3: Implement generator**

```bash
npm install -D tsx
```

`scripts/generate-transitions-sql.ts`:
```ts
import { TRANSITIONS } from "../lib/deals/machine";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function generateSeedSql(): string {
  const values = TRANSITIONS.map(
    (t) =>
      `('${t.from}', '${t.action}', '${t.to}', '${t.actor}', ${
        t.mode === null ? "null" : `'${t.mode}'`
      })`
  ).join(",\n  ");
  return [
    "-- GENERATED by scripts/generate-transitions-sql.ts — do not hand-edit.",
    "truncate table public.deal_transitions;",
    "insert into public.deal_transitions (from_status, action, to_status, actor_role, mode) values",
    `  ${values};`,
    "",
  ].join("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync("supabase/migrations/0005_transitions_seed.sql", generateSeedSql());
  console.log(`wrote ${TRANSITIONS.length} transitions`);
}
```

Add npm script: `"gen:transitions": "tsx scripts/generate-transitions-sql.ts"`.

- [ ] **Step 4: Run tests** — `npm test` → PASS. Then run `npm run gen:transitions` → writes `0005_transitions_seed.sql`.

- [ ] **Step 5: Write the enforcement migration**

`supabase/migrations/0004_transitions.sql`:
```sql
create table public.deal_transitions (
  from_status public.deal_status not null,
  action text not null,
  to_status public.deal_status not null,
  actor_role text not null check (actor_role in ('brand','creator','system','admin')),
  mode public.payment_mode -- null = both modes
);
-- nullable mode can't sit in a PK, and enum->text casts aren't IMMUTABLE for
-- expression indexes; a partial-index pair enforces the same uniqueness
create unique index deal_transitions_uniq_moded on public.deal_transitions
  (from_status, action, actor_role, mode) where mode is not null;
create unique index deal_transitions_uniq_modeless on public.deal_transitions
  (from_status, action, actor_role) where mode is null;
alter table public.deal_transitions enable row level security;
create policy "transitions readable" on public.deal_transitions for select using (true);
-- environment amendment: explicit grant (default ACL gives app roles no DML)
grant select on table public.deal_transitions to authenticated, service_role;

create function public.transition_deal(
  p_deal_id uuid,
  p_action text,
  p_actor_role text
) returns public.deals
language plpgsql security definer set search_path = ''
as $$
declare
  v_deal public.deals;
  v_transition public.deal_transitions;
  v_uid uuid := auth.uid();
begin
  select * into v_deal from public.deals where id = p_deal_id for update;
  if not found then raise exception 'deal not found'; end if;

  -- authorization: the caller must actually be the actor role they claim
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

  -- revision guard
  if p_action = 'request_revision' and v_deal.revision_count >= v_deal.revision_limit then
    raise exception 'revision limit reached';
  end if;

  update public.deals set
    status = v_transition.to_status,
    revision_count = revision_count
      + (case when p_action = 'request_revision' then 1 else 0 end),
    funded_at    = case when v_transition.to_status = 'funded'    then now() else funded_at end,
    accepted_at  = case when v_transition.to_status = 'accepted'  then now() else accepted_at end,
    submitted_at = case when v_transition.to_status = 'submitted' then now() else submitted_at end,
    published_at = case when v_transition.to_status = 'published' then now() else published_at end,
    completed_at = case when v_transition.to_status = 'completed' then now() else completed_at end,
    cancelled_at = case when v_transition.to_status = 'cancelled' then now() else cancelled_at end
  where id = p_deal_id
  returning * into v_deal;

  insert into public.deal_events (deal_id, actor, action, from_status, to_status)
  values (p_deal_id, v_uid, p_action, v_transition.from_status, v_transition.to_status);

  return v_deal;
end;
$$;

revoke all on function public.transition_deal(uuid, text, text) from public;
grant execute on function public.transition_deal(uuid, text, text) to authenticated, service_role;
```

- [ ] **Step 6: Apply** — `supabase db push` (applies 0004 then 0005 seed). Expected: clean.

- [ ] **Step 7: Verify end-to-end in SQL** — Studio SQL (service role):
```sql
select count(*) from public.deal_transitions;  -- expect = TRANSITIONS.length from Task 6
```
Then create a throwaway deal and walk it (replace UUIDs with a real brand profile id / creator profile id created via Studio auth users):
```sql
insert into public.deals (brand_id, creator_id, offering_type, offering_title, price_cents, payment_mode)
values ('<BRAND_UUID>', '<CREATOR_UUID>', 'dedicated_video', 'test', 10000, 'off_platform')
returning id;
select status from public.transition_deal('<DEAL_ID>', 'accept', 'creator'); -- ERROR: not the creator (uid null as service role uses 'system' checks) — expected
select status from public.transition_deal('<DEAL_ID>', 'expire_accept', 'system'); -- returns 'cancelled'
select * from public.deal_events where deal_id = '<DEAL_ID>'; -- 1 row, requested->cancelled
delete from public.deals where id = '<DEAL_ID>';
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: DB-enforced deal transitions — generated seed + transition_deal() RPC"
```

---

### Task 8: Auth pages — signup with role choice, login, logout

**Files:**
- Create: `app/(auth)/signup/page.tsx`, `app/(auth)/login/page.tsx`, `app/(auth)/actions.ts`, `app/auth/callback/route.ts`, `app/auth/error/page.tsx`

**Interfaces:**
- Consumes: `createServerSupabase()` (Task 2); signup metadata `role` consumed by Task 3's trigger.
- Produces: routes `/signup`, `/login`, `/auth/callback`; server actions `signup(formData)`, `login(formData)`, `logout()`. After auth: creators land on `/dashboard`, brands on `/discover` (both are placeholder pages until Phases 2–3).

- [ ] **Step 1: Server actions**

`app/(auth)/actions.ts`:
```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";

export async function signup(formData: FormData) {
  const supabase = await createServerSupabase();
  const role = formData.get("role") === "creator" ? "creator" : "brand";
  const { error } = await supabase.auth.signUp({
    email: String(formData.get("email")),
    password: String(formData.get("password")),
    options: { data: { role, display_name: String(formData.get("display_name") ?? "") } },
  });
  if (error) redirect(`/auth/error?message=${encodeURIComponent(error.message)}`);
  revalidatePath("/", "layout");
  redirect(role === "creator" ? "/dashboard" : "/discover");
}

export async function login(formData: FormData) {
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email")),
    password: String(formData.get("password")),
  });
  if (error) redirect(`/auth/error?message=${encodeURIComponent(error.message)}`);
  const { data } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", data.user!.id).single();
  revalidatePath("/", "layout");
  redirect(profile?.role === "creator" ? "/dashboard" : "/discover");
}

export async function logout() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}
```

- [ ] **Step 2: Pages**

`app/(auth)/signup/page.tsx`:
```tsx
import { signup } from "../actions";

export default function SignupPage() {
  return (
    <main className="mx-auto max-w-sm py-16">
      <h1 className="text-2xl font-semibold mb-6">Create your account</h1>
      <form action={signup} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span>I am a…</span>
          <select name="role" className="border rounded p-2" defaultValue="creator">
            <option value="creator">Video creator</option>
            <option value="brand">Brand</option>
          </select>
        </label>
        <input name="display_name" placeholder="Display name" className="border rounded p-2" required />
        <input name="email" type="email" placeholder="Email" className="border rounded p-2" required />
        <input name="password" type="password" placeholder="Password" minLength={8} className="border rounded p-2" required />
        <button className="bg-black text-white rounded p-2">Sign up</button>
      </form>
    </main>
  );
}
```

`app/(auth)/login/page.tsx`:
```tsx
import { login } from "../actions";

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-sm py-16">
      <h1 className="text-2xl font-semibold mb-6">Log in</h1>
      <form action={login} className="flex flex-col gap-4">
        <input name="email" type="email" placeholder="Email" className="border rounded p-2" required />
        <input name="password" type="password" placeholder="Password" className="border rounded p-2" required />
        <button className="bg-black text-white rounded p-2">Log in</button>
      </form>
    </main>
  );
}
```

`app/auth/error/page.tsx`:
```tsx
export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  return (
    <main className="mx-auto max-w-sm py-16">
      <h1 className="text-2xl font-semibold mb-4">Something went wrong</h1>
      <p className="text-red-600">{message ?? "Unknown auth error."}</p>
      <a className="underline" href="/login">Back to login</a>
    </main>
  );
}
```

`app/auth/callback/route.ts` (email confirmation / future OAuth):
```ts
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/dashboard`);
  }
  return NextResponse.redirect(`${origin}/auth/error?message=Could+not+sign+in`);
}
```

- [ ] **Step 3: Placeholder landing pages** — create minimal `app/dashboard/page.tsx` and `app/discover/page.tsx` so redirects resolve:
```tsx
export default function Page() {
  return <main className="p-8">Coming in the next phase.</main>;
}
```
(Identical content in both files; Phases 2–3 replace them.)

- [ ] **Step 4: Verify manually** — `npm run dev`; sign up as a creator → row appears in `profiles` with role `creator` (check Studio); log out; log in → redirected to `/dashboard`. Sign up a brand → role `brand`, lands on `/discover`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: email auth with role selection, login/logout, auth callback"
```

---

### Task 9: Route protection + role gates

**Files:**
- Create: `lib/auth/require.ts`
- Modify: `app/dashboard/page.tsx`, `app/discover/page.tsx` (wrap with guards)
- Test: `lib/auth/__tests__/require.test.ts`

**Interfaces:**
- Produces: `requireUser()` → `{ user, role }` or redirects to `/login`; `requireRole(role: "creator" | "brand" | "admin")` → same or redirects to `/`. Every protected page in later phases opens with one of these.

- [ ] **Step 1: Write failing test for the pure decision logic**

`lib/auth/__tests__/require.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { gateDecision } from "@/lib/auth/require";

describe("gateDecision", () => {
  it("no user -> redirect to /login", () => {
    expect(gateDecision(null, null, null)).toEqual({ redirect: "/login" });
  });
  it("user without required role -> redirect home", () => {
    expect(gateDecision({ id: "u1" }, "brand", "creator")).toEqual({ redirect: "/" });
  });
  it("user with required role -> pass", () => {
    expect(gateDecision({ id: "u1" }, "creator", "creator")).toEqual({ ok: true });
  });
  it("no role requirement -> any authed user passes", () => {
    expect(gateDecision({ id: "u1" }, "brand", null)).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npm test` → FAIL.

- [ ] **Step 3: Implement**

`lib/auth/require.ts`:
```ts
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

type Role = "creator" | "brand" | "admin";

export function gateDecision(
  user: { id: string } | null,
  actualRole: Role | null,
  requiredRole: Role | null
): { ok: true } | { redirect: string } {
  if (!user) return { redirect: "/login" };
  if (requiredRole && actualRole !== requiredRole) return { redirect: "/" };
  return { ok: true };
}

async function getUserAndRole() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { user: null, role: null as Role | null };
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", data.user.id).single();
  return { user: data.user, role: (profile?.role ?? null) as Role | null };
}

export async function requireUser() {
  const { user, role } = await getUserAndRole();
  const d = gateDecision(user, role, null);
  if ("redirect" in d) redirect(d.redirect);
  if (!role) redirect("/"); // authed but no profile row: broken state, never lie about role
  return { user: user!, role };
}

export async function requireRole(required: Role) {
  const { user, role } = await getUserAndRole();
  const d = gateDecision(user, role, required);
  if ("redirect" in d) redirect(d.redirect);
  return { user: user!, role: role! };
}
```

- [ ] **Step 4: Wire into the placeholder pages**

`app/dashboard/page.tsx`:
```tsx
import { requireRole } from "@/lib/auth/require";

export default async function DashboardPage() {
  await requireRole("creator");
  return <main className="p-8">Creator dashboard — coming in Phase 2.</main>;
}
```

`app/discover/page.tsx`:
```tsx
import { requireUser } from "@/lib/auth/require";

export default async function DiscoverPage() {
  await requireUser();
  return <main className="p-8">Discovery — coming in Phase 3.</main>;
}
```

- [ ] **Step 5: Run tests + verify** — `npm test` → PASS. Manually: logged-out visit to `/dashboard` bounces to `/login`; brand user visiting `/dashboard` bounces to `/`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: auth gates — requireUser/requireRole with tested decision logic"
```

---

## Phase 1 exit criteria

- `npm test` green (state machine, generator, auth gates)
- `npm run build` clean
- All five migrations applied to the linked Supabase project; Supabase advisors show no RLS-disabled tables
- Manual: creator + brand signup/login/logout work; direct `UPDATE deals SET status` as an app role affects 0 rows; `transition_deal()` walks requested→cancelled with an audit row

## What later plans build on this

- Phase 2 (storefronts): `creator_profiles`, `offerings`, `portfolio_items`, `public_creator_stats`, `requireRole("creator")`
- Phase 3 (discovery): FTS indexes on `creator_profiles` (added then), `public_creator_stats`
- Phase 4 (deals + escrow): `transition_deal()`, `deals` insert policy, `payments`/`payouts`/`stripe_events`, `canTransition` for UI affordances
- Phase 5 (verification): `connected_accounts.token_ref` + Vault, pgmq/pg_cron (extensions enabled then)
- Phase 6 (launch): `reviews`, `reports`, admin role gate
