-- Brand area foundations: brand_profiles becomes a real, written table
-- (description, preferences, outreach template, doc paths), plus products,
-- saved discovery searches, a per-brand blocklist, and the brand-docs bucket.

alter table public.brand_profiles
  add column description text check (description is null or length(description) <= 2000),
  add column notes text check (notes is null or length(notes) <= 4000),
  add column pref_niches text[] not null default '{}',
  add column pref_types public.offering_type[] not null default '{}',
  add column outreach_template text
    check (outreach_template is null or length(outreach_template) <= 2000),
  add column guidelines_path text,
  add column rules_path text;

-- Product catalog. Written manually today; the future website-ingestion
-- pipeline proposes rows into this same table.
create table public.brand_products (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  url text,
  description text check (description is null or length(description) <= 500),
  created_at timestamptz not null default now()
);
alter table public.brand_products enable row level security;
create index brand_products_brand_idx on public.brand_products (brand_id);

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

-- Saved discovery searches. params is a plain filter bag; the app whitelists
-- keys on save AND on render, so a tampered blob can't inject URLs.
create table public.saved_filters (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (length(name) between 1 and 40),
  params jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (brand_id, name)
);
alter table public.saved_filters enable row level security;

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

-- Per-brand private blocklist: hidden from that brand's discover and reachout.
create table public.brand_blocklist (
  brand_id uuid not null references public.profiles(id) on delete cascade,
  creator_id uuid not null references public.creator_profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (brand_id, creator_id)
);
alter table public.brand_blocklist enable row level security;

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

-- Private bucket for brand guidelines / influencer-rules documents.
-- Object paths are namespaced <brand_id>/<file>; policies live in 0017
-- (the partner-read rule references conversations, created there).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'brand-docs', 'brand-docs', false, 10485760,
  array['application/pdf','text/plain','text/markdown','application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do nothing;

-- explicit app-role grants (0001 precedent: default ACL gives app roles no DML)
grant select on table public.brand_products to authenticated;
grant insert, delete on table public.brand_products to authenticated;
grant select, insert, delete on table public.saved_filters to authenticated;
grant select, insert, delete on table public.brand_blocklist to authenticated;
grant select, insert, update, delete on table public.brand_products to service_role;
grant select, insert, update, delete on table public.saved_filters to service_role;
grant select, insert, update, delete on table public.brand_blocklist to service_role;
