-- =============================================================================
-- SQUASHED SCHEMA — net result of migrations 0001 through 0034
-- Local-only; safe to use as the single migration on a fresh database.
-- =============================================================================

-- =============================================================================
-- EXTENSIONS
-- =============================================================================

create extension if not exists citext;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists pg_cron;

-- =============================================================================
-- TYPES / ENUMS
-- =============================================================================

create type public.user_role as enum ('creator', 'brand', 'admin');

create type public.platform as enum ('youtube', 'tiktok', 'instagram');

create type public.offering_type as enum
  ('dedicated_video', 'integration', 'short_form_post', 'ugc_video');

-- NOTE: 'funded' and 'in_production' remain in the enum for data-compatibility
-- (Postgres cannot drop enum values). They are never entered by current code.
-- Barter states 'product_sent' / 'product_received' added in 0031.
create type public.deal_status as enum
  ('requested', 'funded', 'accepted', 'in_production', 'submitted',
   'revision_requested', 'published', 'completed', 'cancelled', 'disputed',
   'product_sent', 'product_received');

create type public.payment_mode as enum ('escrow', 'off_platform', 'barter');

-- =============================================================================
-- TABLES (dependency order)
-- =============================================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'brand',
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create table public.creator_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  handle citext unique not null check (handle ~ '^[a-z0-9_]{3,30}$'),
  bio text,
  niches text[] not null default '{}',
  country text,
  languages text[] not null default '{}',
  status text not null default 'draft'
    check (status in ('draft', 'live', 'suspended', 'waitlisted')),
  created_at timestamptz not null default now()
);
alter table public.creator_profiles enable row level security;

create table public.brand_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  company text,
  website text,
  logo_url text,
  description text check (description is null or length(description) <= 2000),
  notes text check (notes is null or length(notes) <= 4000),
  pref_niches text[] not null default '{}',
  pref_types public.offering_type[] not null default '{}',
  pref_types_other text check (char_length(pref_types_other) <= 500),
  outreach_template text check (outreach_template is null or length(outreach_template) <= 2000),
  guidelines_path text,
  rules_path text,
  slug citext unique check (slug is null or slug ~ '^[a-z0-9-]{3,40}$'),
  created_at timestamptz not null default now()
);
alter table public.brand_profiles enable row level security;

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

create table public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles(user_id) on delete cascade,
  media_url text not null check (media_url ~* '^https?://'),
  caption text,
  created_at timestamptz not null default now()
);
alter table public.portfolio_items enable row level security;

create table public.connected_accounts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles(user_id) on delete cascade,
  platform public.platform not null,
  platform_handle text not null,
  token_ref uuid, -- Supabase Vault secret id; never the token itself
  follower_count bigint,
  avg_views bigint,
  engagement_rate numeric(5, 2),
  verification_status text not null default 'pending'
    check (verification_status in ('verified', 'pending', 'stale', 'failed')),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (creator_id, platform)
);
alter table public.connected_accounts enable row level security;

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  -- creator_id references profiles (not creator_profiles): invite-claimed
  -- conversations are created at signup, before the creator wizard runs.
  brand_id uuid not null references public.profiles(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'invited'
    check (status in ('invited', 'accepted', 'declined')),
  invite_message text not null check (length(invite_message) between 1 and 2000),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  archived_by_brand_at timestamptz,
  archived_by_creator_at timestamptz,
  unique (brand_id, creator_id)
);
alter table public.conversations enable row level security;

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.profiles(id),
  creator_id uuid not null references public.creator_profiles(user_id),
  offering_id uuid references public.offerings(id) on delete set null,
  conversation_id uuid references public.conversations(id),
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
  last_revision_note text check (last_revision_note is null or length(last_revision_note) between 1 and 2000),
  live_url text,
  preview_url text,
  marked_paid_at timestamptz, -- off_platform bookkeeping only
  due_date date,
  product_received_at timestamptz,
  preview_due_at timestamptz,
  requested_at timestamptz not null default now(),
  funded_at timestamptz,
  accepted_at timestamptz,
  submitted_at timestamptz,
  published_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz
);
alter table public.deals enable row level security;

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

-- messages: sender_id nullable to allow system messages (kind='system')
create table public.messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid references public.profiles(id),
  body text not null check (length(body) between 1 and 5000),
  attachment_paths text[] not null default '{}',
  kind text not null default 'message' check (kind in ('message', 'system')),
  deal_id_ref uuid references public.deals(id),
  created_at timestamptz not null default now()
);
alter table public.messages enable row level security;

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id),
  stripe_payment_intent_id text unique,
  amount_cents bigint not null,
  currency text not null default 'usd',
  status text not null default 'pending'
    check (status in ('pending', 'succeeded', 'refunded', 'failed')),
  created_at timestamptz not null default now()
);
alter table public.payments enable row level security;

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id),
  stripe_transfer_id text unique,
  amount_cents bigint not null,
  currency text not null default 'usd',
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed')),
  created_at timestamptz not null default now()
);
alter table public.payouts enable row level security;

create table public.stripe_events (
  event_id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;

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

create table public.deal_transitions (
  from_status public.deal_status not null,
  action text not null,
  to_status public.deal_status not null,
  actor_role text not null check (actor_role in ('brand', 'creator', 'system', 'admin')),
  mode public.payment_mode -- null = both modes
);
-- nullable mode can't sit in a PK; partial-index pair enforces same uniqueness
create unique index deal_transitions_uniq_moded on public.deal_transitions
  (from_status, action, actor_role, mode) where mode is not null;
create unique index deal_transitions_uniq_modeless on public.deal_transitions
  (from_status, action, actor_role) where mode is null;
alter table public.deal_transitions enable row level security;

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (length(title) between 1 and 80),
  description text not null check (length(description) between 1 and 2000),
  offering_type public.offering_type not null,
  budget_min_cents bigint not null check (budget_min_cents > 0),
  budget_max_cents bigint not null check (budget_max_cents >= budget_min_cents),
  currency text not null default 'usd',
  apply_by date,
  status text not null default 'open' check (status in ('open', 'closed')),
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  platforms text[] not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.campaigns enable row level security;

create table public.campaign_applications (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  creator_id uuid not null references public.creator_profiles(user_id) on delete cascade,
  pitch text not null check (length(pitch) between 1 and 2000),
  proposed_price_cents bigint not null check (proposed_price_cents > 0),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'withdrawn')),
  deal_id uuid references public.deals(id),
  decline_reason text check (decline_reason is null or length(decline_reason) <= 500),
  created_at timestamptz not null default now(),
  unique (campaign_id, creator_id)
);
alter table public.campaign_applications enable row level security;

create table public.campaign_invites (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  invited_at timestamptz not null default now(),
  unique (campaign_id, creator_id)
);
alter table public.campaign_invites enable row level security;

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  offering_id uuid not null references public.offerings(id),
  price_cents bigint not null check (price_cents between 100 and 100000000),
  note text check (note is null or length(note) <= 2000),
  goals text check (length(goals) between 1 and 2000),
  product_description text check (length(product_description) <= 2000),
  talking_points text check (length(talking_points) <= 2000),
  campaign_id uuid references public.campaigns(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined')),
  deal_id uuid references public.deals(id),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
alter table public.offers enable row level security;
create unique index offers_one_pending_per_conversation
  on public.offers (conversation_id) where status = 'pending';

create table public.creator_invites (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.profiles(id) on delete cascade,
  contact text not null check (length(contact) between 1 and 200),
  token uuid unique not null default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending', 'claimed')),
  claimed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  claimed_at timestamptz
);
alter table public.creator_invites enable row level security;

create table public.brand_products (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  url text,
  description text check (description is null or length(description) <= 500),
  created_at timestamptz not null default now()
);
alter table public.brand_products enable row level security;

create table public.saved_filters (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (length(name) between 1 and 40),
  params jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (brand_id, name)
);
alter table public.saved_filters enable row level security;

create table public.brand_blocklist (
  brand_id uuid not null references public.profiles(id) on delete cascade,
  creator_id uuid not null references public.creator_profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (brand_id, creator_id)
);
alter table public.brand_blocklist enable row level security;

create table public.brand_ingestions (
  brand_id uuid primary key references public.profiles(id) on delete cascade,
  website text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.brand_ingestions enable row level security;

create table public.agent_drafts (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  brand_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(body) between 1 and 5000),
  created_at timestamptz not null default now(),
  unique (conversation_id)
);
alter table public.agent_drafts enable row level security;

create table public.feature_cursors (
  user_id uuid not null references public.profiles(id) on delete cascade,
  feature text not null check (length(feature) between 1 and 30),
  seen_at timestamptz not null default now(),
  primary key (user_id, feature)
);
alter table public.feature_cursors enable row level security;

-- =============================================================================
-- INDEXES
-- =============================================================================

create index offerings_creator_idx on public.offerings (creator_id);
create index portfolio_creator_idx on public.portfolio_items (creator_id);
create index deals_creator_idx on public.deals (creator_id, status);
create index deals_brand_idx on public.deals (brand_id, status);
create index deal_events_deal_idx on public.deal_events (deal_id);
create index messages_conversation_idx on public.messages (conversation_id)
  where conversation_id is not null;
create index conversations_creator_idx on public.conversations (creator_id, status);
create index campaigns_brand_idx on public.campaigns (brand_id, status);
create index campaigns_open_idx on public.campaigns (status, created_at desc);
create index campaign_applications_campaign_idx on public.campaign_applications (campaign_id);
create index campaign_applications_creator_idx on public.campaign_applications (creator_id);
create index creator_invites_brand_idx on public.creator_invites (brand_id);
create index brand_products_brand_idx on public.brand_products (brand_id);
create index offers_conversation_idx on public.offers (conversation_id);
create index offers_campaign_id_idx on public.offers (campaign_id);
-- Discovery search indexes
create index creator_profiles_status_idx on public.creator_profiles (status);
create index creator_profiles_niches_gin on public.creator_profiles using gin (niches);
create index creator_profiles_handle_trgm on public.creator_profiles
  using gin (handle extensions.gin_trgm_ops);
create index creator_profiles_bio_trgm on public.creator_profiles
  using gin (bio extensions.gin_trgm_ops);

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Auto-create profile row on signup; role comes from signup metadata
create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, role, display_name)
  values (
    new.id,
    case new.raw_user_meta_data->>'role'
      when 'creator' then 'creator'::public.user_role
      else 'brand'::public.user_role
    end,
    new.raw_user_meta_data->>'display_name'
  );
  return new;
end;
$$;

-- Suspension guard: only admins may change suspension status
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

create function public.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- deal-creation integrity: snapshot from offering; trusted internal RPCs set
-- clipline.internal='1' to allow non-default initial status.
create function public.validate_deal_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_offering public.offerings;
  v_brand_role public.user_role;
  v_internal boolean :=
    coalesce(current_setting('clipline.internal', true), '') = '1';
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

  -- trusted internal RPCs may set 'accepted'; client inserts always get 'requested'
  if not v_internal then
    new.status := 'requested';
  end if;

  new.revision_count := 0;
  new.requested_at := now();
  new.funded_at := null;
  new.accepted_at := case when new.status = 'accepted' then now() else null end;
  new.submitted_at := null;
  new.published_at := null;
  new.completed_at := null;
  new.cancelled_at := null;
  new.marked_paid_at := null;
  new.live_url := null;
  new.preview_url := null;

  return new;
end;
$$;

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
  v_preview_days int := 3;
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

  if p_action = 'mark_product_received' and v_deal.offering_id is not null then
    select coalesce(o.turnaround_days, 3) into v_preview_days
    from public.offerings o
    where o.id = v_deal.offering_id;
  end if;

  update public.deals set
    status = v_transition.to_status,
    revision_count = revision_count
      + (case when p_action = 'request_revision' then 1 else 0 end),
    preview_url = case when p_action = 'submit_preview' then v_preview else preview_url end,
    live_url = case when p_action = 'mark_published' then v_live else live_url end,
    last_revision_note = case when p_action = 'request_revision' then v_note else last_revision_note end,
    accepted_at = case when v_transition.to_status = 'accepted' then now() else accepted_at end,
    submitted_at = case when v_transition.to_status = 'submitted' then now() else submitted_at end,
    published_at = case when p_action = 'mark_published' then now() else published_at end,
    product_received_at = case when p_action = 'mark_product_received' then now() else product_received_at end,
    preview_due_at = case
      when p_action = 'mark_product_received' then now() + make_interval(days => v_preview_days)
      else preview_due_at
    end,
    completed_at = case when v_transition.to_status = 'completed' then now() else completed_at end,
    cancelled_at = case when v_transition.to_status = 'cancelled' then now() else cancelled_at end
  where id = p_deal_id
  returning * into v_deal;

  insert into public.deal_events (deal_id, actor, action, from_status, to_status, metadata)
  values (p_deal_id, v_uid, p_action, v_transition.from_status, v_transition.to_status,
          coalesce(p_payload, '{}'::jsonb));

  if v_deal.conversation_id is not null then
    v_sys_msg := case p_action
      when 'accept' then 'Creator accepted the deal'
      when 'decline' then 'Creator declined the deal'
      when 'mark_product_sent' then 'Brand marked the product as sent'
      when 'mark_product_received' then 'Creator marked the product as received'
      when 'submit_preview' then 'Preview submitted: ' || coalesce(v_preview, '')
      when 'approve_preview' then 'Brand approved the preview — clear to publish'
      when 'request_revision' then 'Brand requested changes: ' || coalesce(v_note, '(no note)')
      when 'mark_published' then 'Content published: ' || coalesce(v_live, '') || ' — awaiting brand approval'
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
  if v_deal.status not in ('accepted', 'submitted', 'revision_requested', 'published', 'completed') then
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

-- Anti-ghosting timers: 72h accept deadline, 5-day auto-approve.
-- Runs via pg_cron as postgres (auth.uid() is null → system actor rules apply).
create function public.run_deal_timers() returns integer
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

  -- ponytail: preview_due_at exposed but no auto-cancel yet; add expire_preview transition if needed
  return n;
end;
$$;

-- create_deal: canonical deal-creation RPC used by all paths (offer, campaign, direct).
-- Sets clipline.internal before the deal insert so validate_deal_insert allows
-- p_initial_status through.
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

  select * into v_offering from public.offerings o where o.id = p_offering_id;
  if not found or not v_offering.active then
    raise exception 'offering not found or inactive';
  end if;

  if p_brief->>'product_description' is null or p_brief->>'product_description' = '' then
    select string_agg(bp.name, ', ' order by bp.name)
    into v_product_desc
    from public.brand_products bp
    where bp.brand_id = p_brand_id;
  end if;

  perform set_config('clipline.internal', '1', true);
  insert into public.deals
    (brand_id, creator_id, offering_id, offering_type, offering_title,
     price_cents, currency, revision_limit, payment_mode, status)
  values
    (p_brand_id, p_creator_id, v_offering.id, v_offering.type,
     v_offering.title, p_price_cents, v_offering.currency,
     v_offering.revision_limit, 'off_platform',
     p_initial_status::public.deal_status)
  returning id into v_deal_id;
  perform set_config('clipline.internal', '', true);

  insert into public.briefs (deal_id, goals, product_description, talking_points)
  values (
    v_deal_id,
    p_brief->>'goals',
    coalesce(nullif(p_brief->>'product_description', ''), v_product_desc),
    nullif(p_brief->>'talking_points', '')
  );

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

create function public.accept_offer(p_offer_id uuid)
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

create function public.accept_campaign_application(p_application_id uuid)
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

-- Creators self-register a social handle; stats stay null until service-role sync.
create function public.register_social_account(
  p_platform public.platform,
  p_handle text
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_handle text := lower(trim(both '@' from trim(coalesce(p_handle, ''))));
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;
  if not exists (select 1 from public.creator_profiles cp where cp.user_id = v_uid) then
    raise exception 'Create your creator profile first';
  end if;
  if v_handle !~ '^[a-z0-9][a-z0-9._-]{1,29}$' then
    raise exception 'Invalid handle';
  end if;

  insert into public.connected_accounts as ca (creator_id, platform, platform_handle)
  values (v_uid, p_platform, v_handle)
  on conflict (creator_id, platform) do update set
    platform_handle = excluded.platform_handle,
    follower_count = case when ca.platform_handle = excluded.platform_handle
                         then ca.follower_count else null end,
    avg_views = case when ca.platform_handle = excluded.platform_handle
                    then ca.avg_views else null end,
    engagement_rate = case when ca.platform_handle = excluded.platform_handle
                          then ca.engagement_rate else null end,
    last_synced_at = case when ca.platform_handle = excluded.platform_handle
                         then ca.last_synced_at else null end,
    verification_status = case when ca.platform_handle = excluded.platform_handle
                              then ca.verification_status else 'pending' end;
    -- token_ref deliberately absent from the update list
end;
$$;

create function public.claim_creator_invite(p_token uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_invite public.creator_invites;
begin
  if v_uid is null then return; end if;
  select * into v_invite from public.creator_invites i
  where i.token = p_token and i.status = 'pending' for update;
  if not found then return; end if;
  if v_invite.brand_id = v_uid then return; end if;
  if not exists (select 1 from public.profiles p
                 where p.id = v_uid and p.role = 'creator') then
    return;
  end if;

  update public.creator_invites
  set status = 'claimed', claimed_by = v_uid, claimed_at = now()
  where id = v_invite.id;

  perform set_config('clipline.internal', '1', true);
  insert into public.conversations
    (brand_id, creator_id, status, invite_message, responded_at)
  values
    (v_invite.brand_id, v_uid, 'accepted',
     'Joined Clipline from your invite.', now())
  on conflict (brand_id, creator_id) do nothing;
  perform set_config('clipline.internal', '', true);
end;
$$;

create function public.set_conversation_archived(
  p_conversation_id uuid,
  p_archived boolean
) returns public.conversations
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_conv public.conversations;
  v_ts timestamptz := case when p_archived then now() else null end;
begin
  select * into v_conv from public.conversations c where c.id = p_conversation_id;
  if not found then raise exception 'conversation not found'; end if;
  if v_conv.brand_id = v_uid then
    update public.conversations set archived_by_brand_at = v_ts where id = p_conversation_id returning * into v_conv;
  elsif v_conv.creator_id = v_uid then
    update public.conversations set archived_by_creator_at = v_ts where id = p_conversation_id returning * into v_conv;
  else
    raise exception 'not a participant';
  end if;
  return v_conv;
end;
$$;

-- Security-definer helper: breaks the campaigns↔campaign_invites RLS cycle
create function public.campaign_brand_id(p_campaign_id uuid)
returns uuid
language sql security definer set search_path = ''
stable
as $$
  select brand_id from public.campaigns where id = p_campaign_id;
$$;

create function public.invite_to_campaign(
  p_campaign_id uuid,
  p_creator_id uuid
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_brand uuid;
  v_conv_id uuid;
begin
  select brand_id into v_brand from public.campaigns where id = p_campaign_id;
  if v_brand is null then raise exception 'campaign not found'; end if;
  if v_brand <> v_uid then raise exception 'not campaign owner'; end if;

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

-- Conversation insert/update: validates reachout path; internal flag bypasses
-- for invite-claim and create_deal paths.
create function public.validate_conversation_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_internal boolean :=
    coalesce(current_setting('clipline.internal', true), '') = '1';
  v_creator_role public.user_role;
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
    new.status := 'invited';
    new.responded_at := null;
  end if;

  new.created_at := now();
  return new;
end;
$$;

create function public.validate_conversation_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return new;
  end if;
  if new.brand_id <> old.brand_id
     or new.creator_id <> old.creator_id
     or new.invite_message <> old.invite_message
     or new.created_at <> old.created_at then
    raise exception 'Conversation identity cannot change';
  end if;

  -- Archive-only update: allow any participant
  if new.status = old.status
     and new.responded_at is not distinct from old.responded_at
     and (new.archived_by_brand_at is distinct from old.archived_by_brand_at
          or new.archived_by_creator_at is distinct from old.archived_by_creator_at) then
    return new;
  end if;

  if v_uid = old.creator_id then
    if old.status <> 'invited' or new.status not in ('accepted', 'declined') then
      raise exception 'This invitation has already been answered';
    end if;
    new.responded_at := now();
  else
    raise exception 'Only the invited creator can respond';
  end if;
  return new;
end;
$$;

create function public.validate_offer_insert()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_conv public.conversations;
  v_offering public.offerings;
  v_max bigint;
begin
  select * into v_conv from public.conversations c where c.id = new.conversation_id;
  if not found or v_conv.status <> 'accepted' then
    raise exception 'Offers can only be sent in an accepted conversation';
  end if;
  if auth.uid() is distinct from v_conv.brand_id then
    raise exception 'Only the brand can send an offer';
  end if;
  select * into v_offering from public.offerings o where o.id = new.offering_id;
  if not found or not v_offering.active then
    raise exception 'That offering is no longer available';
  end if;
  if v_offering.creator_id <> v_conv.creator_id then
    raise exception 'Offering does not belong to this creator';
  end if;

  if new.campaign_id is not null then
    select budget_max_cents into v_max from public.campaigns where id = new.campaign_id;
    if v_max is not null and new.price_cents > v_max then
      raise exception 'Offer exceeds the campaign budget cap of % cents', v_max;
    end if;
  end if;

  new.status := 'pending';
  new.deal_id := null;
  new.created_at := now();
  new.decided_at := null;
  return new;
end;
$$;

create function public.validate_offer_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_creator uuid;
begin
  if v_uid is null
     or coalesce(current_setting('clipline.internal', true), '') = '1' then
    return new;
  end if;
  if new.conversation_id <> old.conversation_id
     or new.offering_id <> old.offering_id
     or new.price_cents <> old.price_cents
     or new.note is distinct from old.note
     or new.created_at <> old.created_at then
    raise exception 'Offer terms cannot be edited — send a new offer';
  end if;
  select creator_id into v_creator from public.conversations c
  where c.id = old.conversation_id;
  if v_uid <> v_creator then
    raise exception 'Only the creator can respond to an offer';
  end if;
  if old.status <> 'pending' or new.status <> 'declined' then
    raise exception 'Accepting an offer goes through accept_offer';
  end if;
  new.decided_at := now();
  new.deal_id := null;
  return new;
end;
$$;

create function public.validate_campaign_application_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_campaign public.campaigns;
  v_has_account boolean;
  v_has_portfolio boolean;
begin
  select * into v_campaign from public.campaigns c where c.id = new.campaign_id;
  if not found or v_campaign.status <> 'open' then
    raise exception 'This campaign is not open for applications';
  end if;
  if v_campaign.apply_by is not null and v_campaign.apply_by < current_date then
    raise exception 'The application window for this campaign has closed';
  end if;
  if v_campaign.brand_id = new.creator_id then
    raise exception 'You cannot apply to your own campaign';
  end if;
  if not exists (
    select 1 from public.offerings o
    where o.creator_id = new.creator_id
      and o.type = v_campaign.offering_type
      and o.active
  ) then
    raise exception 'This campaign needs an active % offering — add one, or book another format',
      v_campaign.offering_type;
  end if;

  select exists(
    select 1 from public.connected_accounts a where a.creator_id = new.creator_id
  ) into v_has_account;
  select exists(
    select 1 from public.portfolio_items p where p.creator_id = new.creator_id
  ) into v_has_portfolio;
  if not v_has_account or not v_has_portfolio then
    raise exception 'Storefront incomplete: add a channel and a sample before applying';
  end if;

  if coalesce(array_length(v_campaign.platforms, 1), 0) > 0 and not exists (
    select 1 from public.connected_accounts a
    where a.creator_id = new.creator_id
      and a.platform::text = any (v_campaign.platforms)
  ) then
    raise exception 'This campaign requires a connected account on one of its target platforms';
  end if;

  new.status := 'pending';
  new.created_at := now();
  return new;
end;
$$;

create function public.validate_campaign_application_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_brand uuid;
begin
  if v_uid is null then
    return new;
  end if;

  if new.campaign_id <> old.campaign_id
     or new.creator_id <> old.creator_id
     or new.created_at <> old.created_at then
    raise exception 'Application identity cannot change';
  end if;

  select brand_id into v_brand from public.campaigns c where c.id = old.campaign_id;

  if v_uid = old.creator_id then
    if old.status <> 'pending' then
      raise exception 'Only pending applications can be changed';
    end if;
    if new.status not in ('pending', 'withdrawn') then
      raise exception 'Creators can only withdraw an application';
    end if;
  elsif v_uid = v_brand then
    if new.pitch <> old.pitch
       or new.proposed_price_cents <> old.proposed_price_cents then
      raise exception 'Brands cannot edit an application';
    end if;
    if old.status <> 'pending' or new.status not in ('accepted', 'declined') then
      raise exception 'Only pending applications can be accepted or declined';
    end if;
  else
    raise exception 'Not allowed';
  end if;

  return new;
end;
$$;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger creator_status_guard
  before update on public.creator_profiles
  for each row execute function public.enforce_creator_status_rules();

create trigger deals_validate_insert
  before insert on public.deals
  for each row execute function public.validate_deal_insert();

create trigger conversations_validate_insert
  before insert on public.conversations
  for each row execute function public.validate_conversation_insert();

create trigger conversations_validate_update
  before update on public.conversations
  for each row execute function public.validate_conversation_update();

create trigger offers_validate_insert
  before insert on public.offers
  for each row execute function public.validate_offer_insert();

create trigger offers_validate_update
  before update on public.offers
  for each row execute function public.validate_offer_update();

create trigger campaign_applications_validate_insert
  before insert on public.campaign_applications
  for each row execute function public.validate_campaign_application_insert();

create trigger campaign_applications_validate_update
  before update on public.campaign_applications
  for each row execute function public.validate_campaign_application_update();

-- =============================================================================
-- POLICIES (RLS)
-- =============================================================================

-- profiles
create policy "profiles are publicly readable"
  on public.profiles for select using (true);
create policy "users update own profile"
  on public.profiles for update using ((select auth.uid()) = id);

-- creator_profiles
create policy "live creator profiles are public, owners see own"
  on public.creator_profiles for select
  using (status = 'live' or (select auth.uid()) = user_id);
create policy "creators insert own"
  on public.creator_profiles for insert
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.profiles p
                where p.id = (select auth.uid()) and p.role = 'creator')
  );
create policy "creators update own"
  on public.creator_profiles for update using ((select auth.uid()) = user_id);
create policy "admins read all creator profiles"
  on public.creator_profiles for select to authenticated
  using (public.is_admin());
create policy "admins update creator profiles"
  on public.creator_profiles for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- brand_profiles
create policy "brand profiles readable by authenticated"
  on public.brand_profiles for select to authenticated using (true);
create policy "brands insert own"
  on public.brand_profiles for insert
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.profiles p
                where p.id = (select auth.uid()) and p.role = 'brand')
  );
create policy "brands update own"
  on public.brand_profiles for update using ((select auth.uid()) = user_id);

-- offerings
create policy "active offerings public for live creators, owners see own"
  on public.offerings for select
  using (
    (active = true and exists (select 1 from public.creator_profiles cp
                               where cp.user_id = creator_id and cp.status = 'live'))
    or (select auth.uid()) = creator_id
  );
create policy "creators insert own offerings"
  on public.offerings for insert
  with check ((select auth.uid()) = creator_id);
create policy "creators update own offerings"
  on public.offerings for update
  using ((select auth.uid()) = creator_id)
  with check ((select auth.uid()) = creator_id);
create policy "creators delete own offerings"
  on public.offerings for delete
  using ((select auth.uid()) = creator_id);

-- portfolio_items
create policy "portfolio public for live creators"
  on public.portfolio_items for select
  using (
    exists (select 1 from public.creator_profiles cp
            where cp.user_id = creator_id and cp.status = 'live')
    or (select auth.uid()) = creator_id
  );
create policy "creators insert own portfolio"
  on public.portfolio_items for insert
  with check ((select auth.uid()) = creator_id);
create policy "creators update own portfolio"
  on public.portfolio_items for update
  using ((select auth.uid()) = creator_id)
  with check ((select auth.uid()) = creator_id);
create policy "creators delete own portfolio"
  on public.portfolio_items for delete
  using ((select auth.uid()) = creator_id);

-- connected_accounts (owner-only: token_ref must not be publicly readable)
create policy "creators manage own connected accounts"
  on public.connected_accounts for all
  using ((select auth.uid()) = creator_id)
  with check ((select auth.uid()) = creator_id);

-- deals
create policy "participants read own deals"
  on public.deals for select
  using ((select auth.uid()) in (brand_id, creator_id));
create policy "brands create deals as requested"
  on public.deals for insert
  with check ((select auth.uid()) = brand_id and status = 'requested');
create policy "admins read all deals"
  on public.deals for select to authenticated
  using (public.is_admin());

-- briefs
create policy "participants read brief" on public.briefs for select
  using (exists (select 1 from public.deals d
                 where d.id = deal_id and (select auth.uid()) in (d.brand_id, d.creator_id)));
create policy "brand writes brief" on public.briefs for insert
  with check (exists (select 1 from public.deals d
                      where d.id = deal_id and (select auth.uid()) = d.brand_id));
create policy "admins read all briefs"
  on public.briefs for select to authenticated
  using (public.is_admin());

-- deal_events
create policy "participants read deal events" on public.deal_events for select
  using (exists (select 1 from public.deals d
                 where d.id = deal_id and (select auth.uid()) in (d.brand_id, d.creator_id)));
create policy "admins read all deal events"
  on public.deal_events for select to authenticated
  using (public.is_admin());

-- messages
create policy "conversation participants read messages"
  on public.messages for select
  using (exists (select 1 from public.conversations c
                 where c.id = conversation_id
                   and (select auth.uid()) in (c.brand_id, c.creator_id)));
create policy "conversation participants send messages"
  on public.messages for insert
  with check ((select auth.uid()) = sender_id
    and exists (select 1 from public.conversations c
                where c.id = conversation_id
                  and c.status = 'accepted'
                  and (select auth.uid()) in (c.brand_id, c.creator_id)));
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
create policy "admins read all messages"
  on public.messages for select to authenticated
  using (public.is_admin());

-- payments
create policy "participants read payments" on public.payments for select
  using (exists (select 1 from public.deals d
                 where d.id = deal_id and (select auth.uid()) in (d.brand_id, d.creator_id)));

-- payouts
create policy "creator reads own payouts" on public.payouts for select
  using (exists (select 1 from public.deals d
                 where d.id = deal_id and (select auth.uid()) = d.creator_id));

-- reviews
create policy "reviews are public" on public.reviews for select using (true);
create policy "participants review completed deals" on public.reviews for insert
  with check ((select auth.uid()) = author_id
    and exists (select 1 from public.deals d
                where d.id = deal_id and d.status = 'completed'
                  and (select auth.uid()) in (d.brand_id, d.creator_id)));

-- reports
create policy "reporter reads own reports" on public.reports for select
  using ((select auth.uid()) = reporter_id);
create policy "authenticated users file reports" on public.reports for insert
  with check ((select auth.uid()) = reporter_id);
create policy "admins read all reports"
  on public.reports for select to authenticated
  using (public.is_admin());
create policy "admins resolve reports"
  on public.reports for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- deal_transitions
create policy "transitions readable" on public.deal_transitions for select using (true);

-- campaigns
create policy "campaigns visibility policy" on public.campaigns
  for select to authenticated using (
    (visibility = 'public' and status = 'open')
    or brand_id = (select auth.uid())
    or exists (
      select 1 from public.campaign_invites ci
      where ci.campaign_id = id and ci.creator_id = (select auth.uid())
    )
  );
create policy "brands create own campaigns"
  on public.campaigns for insert
  with check (
    (select auth.uid()) = brand_id
    and status = 'open'
    and exists (select 1 from public.profiles p
                where p.id = (select auth.uid()) and p.role = 'brand')
  );
create policy "brands update own campaigns"
  on public.campaigns for update
  using ((select auth.uid()) = brand_id)
  with check ((select auth.uid()) = brand_id);

-- campaign_applications
create policy "applicant and campaign owner read applications"
  on public.campaign_applications for select
  using (
    (select auth.uid()) = creator_id
    or exists (select 1 from public.campaigns c
               where c.id = campaign_id and c.brand_id = (select auth.uid()))
  );
create policy "creators apply as themselves"
  on public.campaign_applications for insert
  with check (
    (select auth.uid()) = creator_id
    and exists (select 1 from public.profiles p
                where p.id = (select auth.uid()) and p.role = 'creator')
  );
create policy "applicant and campaign owner update applications"
  on public.campaign_applications for update
  using (
    (select auth.uid()) = creator_id
    or exists (select 1 from public.campaigns c
               where c.id = campaign_id and c.brand_id = (select auth.uid()))
  )
  with check (
    (select auth.uid()) = creator_id
    or exists (select 1 from public.campaigns c
               where c.id = campaign_id and c.brand_id = (select auth.uid()))
  );

-- campaign_invites (security-definer helper breaks RLS cycle with campaigns)
create policy "brand sees own campaign invites" on public.campaign_invites
  for select to authenticated using (
    creator_id = (select auth.uid())
    or public.campaign_brand_id(campaign_id) = (select auth.uid())
  );

-- conversations
create policy "participants read conversations"
  on public.conversations for select
  using ((select auth.uid()) in (brand_id, creator_id));
create policy "brands invite creators"
  on public.conversations for insert
  with check (
    (select auth.uid()) = brand_id
    and exists (select 1 from public.profiles p
                where p.id = (select auth.uid()) and p.role = 'brand')
  );
create policy "participants update conversations"
  on public.conversations for update
  using ((select auth.uid()) in (brand_id, creator_id));

-- offers
create policy "participants read offers"
  on public.offers for select
  using (exists (select 1 from public.conversations c
                 where c.id = conversation_id
                   and (select auth.uid()) in (c.brand_id, c.creator_id)));
create policy "brands send offers"
  on public.offers for insert
  with check (exists (select 1 from public.conversations c
                      where c.id = conversation_id
                        and (select auth.uid()) = c.brand_id));
create policy "participants update offers"
  on public.offers for update
  using (exists (select 1 from public.conversations c
                 where c.id = conversation_id
                   and (select auth.uid()) in (c.brand_id, c.creator_id)));

-- creator_invites
create policy "brands read own invites"
  on public.creator_invites for select using ((select auth.uid()) = brand_id);
create policy "brands create own invites"
  on public.creator_invites for insert
  with check (
    (select auth.uid()) = brand_id
    and exists (select 1 from public.profiles p
                where p.id = (select auth.uid()) and p.role = 'brand')
  );

-- brand_products
create policy "brand products readable by authenticated"
  on public.brand_products for select to authenticated using (true);
create policy "brands insert own products"
  on public.brand_products for insert
  with check (
    (select auth.uid()) = brand_id
    and exists (select 1 from public.profiles p
                where p.id = (select auth.uid()) and p.role = 'brand')
  );
create policy "brands delete own products"
  on public.brand_products for delete
  using ((select auth.uid()) = brand_id);

-- saved_filters
create policy "brands read own saved filters"
  on public.saved_filters for select using ((select auth.uid()) = brand_id);
create policy "brands insert own saved filters"
  on public.saved_filters for insert
  with check (
    (select auth.uid()) = brand_id
    and exists (select 1 from public.profiles p
                where p.id = (select auth.uid()) and p.role = 'brand')
  );
create policy "brands delete own saved filters"
  on public.saved_filters for delete
  using ((select auth.uid()) = brand_id);

-- brand_blocklist
create policy "brands read own blocklist"
  on public.brand_blocklist for select using ((select auth.uid()) = brand_id);
create policy "brands insert own blocklist"
  on public.brand_blocklist for insert
  with check (
    (select auth.uid()) = brand_id
    and exists (select 1 from public.profiles p
                where p.id = (select auth.uid()) and p.role = 'brand')
  );
create policy "brands delete own blocklist"
  on public.brand_blocklist for delete
  using ((select auth.uid()) = brand_id);

-- brand_ingestions
create policy "brands read own ingestion"
  on public.brand_ingestions for select using ((select auth.uid()) = brand_id);
create policy "brands write own ingestion"
  on public.brand_ingestions for insert
  with check (
    (select auth.uid()) = brand_id
    and exists (select 1 from public.profiles p
                where p.id = (select auth.uid()) and p.role = 'brand')
  );
create policy "brands replace own ingestion"
  on public.brand_ingestions for update using ((select auth.uid()) = brand_id);
create policy "brands delete own ingestion"
  on public.brand_ingestions for delete using ((select auth.uid()) = brand_id);

-- agent_drafts
create policy "brands read own drafts"
  on public.agent_drafts for select using ((select auth.uid()) = brand_id);
create policy "brands write own drafts"
  on public.agent_drafts for insert
  with check (
    (select auth.uid()) = brand_id
    and exists (select 1 from public.conversations c
                where c.id = conversation_id and c.brand_id = (select auth.uid()))
  );
create policy "brands replace own drafts"
  on public.agent_drafts for update using ((select auth.uid()) = brand_id);
create policy "brands delete own drafts"
  on public.agent_drafts for delete using ((select auth.uid()) = brand_id);

-- feature_cursors
create policy "users read own cursors"
  on public.feature_cursors for select
  using ((select auth.uid()) = user_id);
create policy "users upsert own cursors"
  on public.feature_cursors for insert
  with check ((select auth.uid()) = user_id);
create policy "users update own cursors"
  on public.feature_cursors for update
  using ((select auth.uid()) = user_id);

-- =============================================================================
-- VIEWS
-- =============================================================================

-- Public stats surface WITHOUT token_ref (definer view bypasses base RLS deliberately)
create view public.public_creator_stats
  with (security_invoker = off) as
  select ca.creator_id, ca.platform, ca.platform_handle,
         ca.follower_count, ca.avg_views, ca.engagement_rate,
         ca.verification_status, ca.last_synced_at
  from public.connected_accounts ca
  join public.creator_profiles cp on cp.user_id = ca.creator_id
  where cp.status = 'live';

-- Brand-authored reviews mapped to the reviewed creator.
-- Definer view: deals RLS is participant-only so anon storefront reads need this.
create view public.public_creator_reviews
  with (security_invoker = off) as
  select d.creator_id, r.rating, r.body, r.created_at
  from public.reviews r
  join public.deals d on d.id = r.deal_id
  where r.author_id = d.brand_id;

-- Creator → brand reviews (public projection)
create view public.public_brand_reviews
  with (security_invoker = off) as
select r.id, r.deal_id, d.brand_id, r.rating, r.body, r.created_at
from public.reviews r
join public.deals d on d.id = r.deal_id
where r.author_id = d.creator_id;

create view public.campaign_response_time as
select
  ci.id as invite_id,
  ci.campaign_id,
  ci.creator_id,
  ci.invited_at,
  c.responded_at,
  extract(epoch from (c.responded_at - ci.invited_at)) * 1000 as response_time_ms
from public.campaign_invites ci
join public.conversations c on c.id = ci.conversation_id
where c.responded_at is not null;

-- =============================================================================
-- GRANTS
-- =============================================================================

-- profiles (UPDATE stays column-limited via revoke+column grant)
revoke update on table public.profiles from anon, authenticated;
grant update (display_name, avatar_url) on table public.profiles to authenticated;
grant select on table public.profiles to anon, authenticated;
grant select, insert, update, delete on table public.profiles to service_role;

-- creator_profiles
grant select on table public.creator_profiles to anon, authenticated;
grant insert, update on table public.creator_profiles to authenticated;
grant select, insert, update, delete on table public.creator_profiles to service_role;

-- brand_profiles
grant select, insert, update on table public.brand_profiles to authenticated;
grant select, insert, update, delete on table public.brand_profiles to service_role;

-- offerings
grant select on table public.offerings to anon, authenticated;
grant insert, update, delete on table public.offerings to authenticated;
grant select, insert, update, delete on table public.offerings to service_role;

-- portfolio_items
grant select on table public.portfolio_items to anon, authenticated;
grant insert, update, delete on table public.portfolio_items to authenticated;
grant select, insert, update, delete on table public.portfolio_items to service_role;

-- connected_accounts (insert/update reserved for service-role sync; owners get select+delete)
revoke insert, update on table public.connected_accounts from anon, authenticated;
grant select, delete on table public.connected_accounts to authenticated;
grant select, insert, update, delete on table public.connected_accounts to service_role;

-- deals (no update grant to authenticated: all status changes via transition_deal RPC)
grant select, insert on table public.deals to authenticated;
grant select, insert, update, delete on table public.deals to service_role;

-- briefs
grant select, insert on table public.briefs to authenticated;
grant select, insert, update, delete on table public.briefs to service_role;

-- deal_events (inserts only via security-definer functions)
grant select on table public.deal_events to authenticated;
grant select, insert, update, delete on table public.deal_events to service_role;

-- messages
grant select, insert on table public.messages to authenticated;
grant select, insert, update, delete on table public.messages to service_role;

-- payments / payouts
grant select on table public.payments to authenticated;
grant select on table public.payouts to authenticated;
grant select, insert, update, delete on table public.payments to service_role;
grant select, insert, update, delete on table public.payouts to service_role;
grant select, insert, update, delete on table public.stripe_events to service_role;

-- reviews
grant select on table public.reviews to anon, authenticated;
grant insert on table public.reviews to authenticated;
grant select, insert, update, delete on table public.reviews to service_role;

-- reports
grant select, insert on table public.reports to authenticated;
grant update on table public.reports to authenticated;
grant select, insert, update, delete on table public.reports to service_role;

-- deal_transitions
grant select on table public.deal_transitions to authenticated, service_role;

-- campaigns
grant select on table public.campaigns to authenticated;
grant insert on table public.campaigns to authenticated;
grant update (title, description, offering_type, budget_min_cents,
              budget_max_cents, apply_by, status)
  on table public.campaigns to authenticated;
grant select, insert, update, delete on table public.campaigns to service_role;

-- campaign_applications
grant select, insert on table public.campaign_applications to authenticated;
grant update (pitch, proposed_price_cents, status, decline_reason)
  on table public.campaign_applications to authenticated;
grant select, insert, update, delete on table public.campaign_applications to service_role;

-- campaign_invites
grant select on table public.campaign_invites to authenticated;
grant select, insert, update, delete on table public.campaign_invites to service_role;

-- conversations
grant select, insert on table public.conversations to authenticated;
grant update (status, responded_at) on table public.conversations to authenticated;
grant select, insert, update, delete on table public.conversations to service_role;

-- offers
grant select, insert on table public.offers to authenticated;
grant update (status, decided_at, deal_id) on table public.offers to authenticated;
grant select, insert, update, delete on table public.offers to service_role;

-- creator_invites
grant select, insert on table public.creator_invites to authenticated;
grant select, insert, update, delete on table public.creator_invites to service_role;

-- brand_products
grant select on table public.brand_products to authenticated;
grant insert, delete on table public.brand_products to authenticated;
grant select, insert, update, delete on table public.brand_products to service_role;

-- saved_filters / brand_blocklist
grant select, insert, delete on table public.saved_filters to authenticated;
grant select, insert, delete on table public.brand_blocklist to authenticated;
grant select, insert, update, delete on table public.saved_filters to service_role;
grant select, insert, update, delete on table public.brand_blocklist to service_role;

-- brand_ingestions / agent_drafts
grant select, insert, update, delete on table public.brand_ingestions to authenticated;
grant select, insert, update, delete on table public.agent_drafts to authenticated;
grant select, insert, update, delete on table public.brand_ingestions to service_role;
grant select, insert, update, delete on table public.agent_drafts to service_role;

-- feature_cursors
grant select, insert, update on table public.feature_cursors to authenticated;
grant select, insert, update, delete on table public.feature_cursors to service_role;

-- views
grant select on public.public_creator_stats to anon, authenticated;
grant select on public.public_creator_reviews to anon, authenticated;
grant select on public.public_brand_reviews to anon, authenticated;
grant select on public.campaign_response_time to authenticated;

-- functions
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;
revoke all on function public.transition_deal(uuid, text, text, jsonb) from public;
grant execute on function public.transition_deal(uuid, text, text, jsonb) to authenticated, service_role;
revoke all on function public.mark_deal_paid(uuid) from public;
grant execute on function public.mark_deal_paid(uuid) to authenticated;
revoke all on function public.run_deal_timers() from public;
grant execute on function public.run_deal_timers() to service_role;
revoke all on function public.create_deal(uuid,uuid,uuid,bigint,jsonb,text,jsonb,text) from public;
grant execute on function public.create_deal(uuid,uuid,uuid,bigint,jsonb,text,jsonb,text) to authenticated, service_role;
revoke all on function public.accept_offer(uuid) from public;
grant execute on function public.accept_offer(uuid) to authenticated;
revoke all on function public.accept_campaign_application(uuid) from public;
grant execute on function public.accept_campaign_application(uuid) to authenticated;
revoke execute on function public.register_social_account(public.platform, text) from public, anon;
grant execute on function public.register_social_account(public.platform, text) to authenticated, service_role;
revoke all on function public.claim_creator_invite(uuid) from public;
grant execute on function public.claim_creator_invite(uuid) to authenticated;
grant execute on function public.set_conversation_archived(uuid, boolean) to authenticated;
grant execute on function public.invite_to_campaign(uuid, uuid) to authenticated;

-- =============================================================================
-- STORAGE BUCKETS
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'brand-docs', 'brand-docs', false, 10485760,
  array['application/pdf', 'text/plain', 'text/markdown', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do nothing;

create policy "brands upload own docs"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'brand-docs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "brands update own docs"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'brand-docs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "brands delete own docs"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'brand-docs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "brand docs readable by owner and partners"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'brand-docs'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (select 1 from public.deals d
                 where d.brand_id::text = (storage.foldername(name))[1]
                   and d.creator_id = (select auth.uid()))
      or exists (select 1 from public.conversations c
                 where c.brand_id::text = (storage.foldername(name))[1]
                   and c.creator_id = (select auth.uid())
                   and c.status = 'accepted')
    )
  );

-- =============================================================================
-- CRON JOBS
-- =============================================================================

select cron.schedule('deal-timers', '*/15 * * * *', 'select public.run_deal_timers()');

-- =============================================================================
-- SEED DATA — deal transitions
-- =============================================================================

insert into public.deal_transitions (from_status, action, to_status, actor_role, mode) values
  ('requested', 'accept', 'accepted', 'creator', null),
  ('requested', 'decline', 'cancelled', 'creator', null),
  ('requested', 'expire_accept', 'cancelled', 'system', null),
  ('accepted', 'mark_product_sent', 'product_sent', 'brand', 'barter'),
  ('product_sent', 'mark_product_received', 'product_received', 'creator', 'barter'),
  ('product_received', 'submit_preview', 'submitted', 'creator', 'barter'),
  ('accepted', 'submit_preview', 'submitted', 'creator', 'escrow'),
  ('accepted', 'submit_preview', 'submitted', 'creator', 'off_platform'),
  ('revision_requested', 'submit_preview', 'submitted', 'creator', null),
  ('submitted', 'request_revision', 'revision_requested', 'brand', null),
  ('submitted', 'approve_preview', 'submitted', 'brand', null),
  ('submitted', 'mark_published', 'published', 'creator', null),
  ('published', 'approve', 'completed', 'brand', null),
  ('published', 'auto_approve', 'completed', 'system', null),
  ('requested', 'cancel', 'cancelled', 'brand', null),
  ('accepted', 'cancel', 'cancelled', 'brand', null),
  ('accepted', 'cancel', 'cancelled', 'creator', null),
  ('accepted', 'dispute', 'disputed', 'brand', null),
  ('accepted', 'dispute', 'disputed', 'creator', null),
  ('product_sent', 'dispute', 'disputed', 'brand', null),
  ('product_sent', 'dispute', 'disputed', 'creator', null),
  ('product_received', 'dispute', 'disputed', 'brand', null),
  ('product_received', 'dispute', 'disputed', 'creator', null),
  ('submitted', 'dispute', 'disputed', 'brand', null),
  ('submitted', 'dispute', 'disputed', 'creator', null),
  ('revision_requested', 'dispute', 'disputed', 'brand', null),
  ('revision_requested', 'dispute', 'disputed', 'creator', null),
  ('published', 'dispute', 'disputed', 'brand', null),
  ('published', 'dispute', 'disputed', 'creator', null),
  ('disputed', 'resolve_release', 'completed', 'admin', null),
  ('disputed', 'resolve_refund', 'cancelled', 'admin', null);
