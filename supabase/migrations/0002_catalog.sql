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

-- privileged-column lockdown (human-approved precedent from 0001):
-- only service-role sync jobs may create/update connected accounts;
-- owners retain select (RLS) and delete (disconnect)
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
