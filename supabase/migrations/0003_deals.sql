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

-- deal-creation integrity (human-approved precedent: client-reachable writes
-- must be validated): snapshot is forced from the referenced offering,
-- self-dealing is rejected, and only brand accounts can book
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
