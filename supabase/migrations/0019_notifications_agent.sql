-- In-app notifications, website-ingestion proposals, and brand-agent drafts.

-- Notifications are written by the server (service role) only — the app has
-- no insert grant, so a client can't forge notifications for other users.
create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (length(kind) between 1 and 40),
  title text not null check (length(title) between 1 and 200),
  body text check (body is null or length(body) <= 2000),
  href text check (href is null or href ~ '^/'),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
alter table public.notifications enable row level security;
create index notifications_unread_idx on public.notifications (user_id)
  where read_at is null;
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create policy "users read own notifications"
  on public.notifications for select using ((select auth.uid()) = user_id);
create policy "users mark own notifications read"
  on public.notifications for update using ((select auth.uid()) = user_id);

-- Website-ingestion proposals live beside (not inside) brand_profiles so the
-- "brand_profiles row exists = onboarded" rule stays intact. The proposal is
-- only ever a suggestion — nothing applies until the brand saves the form.
create table public.brand_ingestions (
  brand_id uuid primary key references public.profiles(id) on delete cascade,
  website text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.brand_ingestions enable row level security;

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

-- Agent drafts: AI-suggested replies for a brand's conversation. Draft-only
-- by construction — sending still goes through the normal message action,
-- which requires the brand to submit the composer themselves.
create table public.agent_drafts (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  brand_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(body) between 1 and 5000),
  created_at timestamptz not null default now(),
  unique (conversation_id)
);
alter table public.agent_drafts enable row level security;

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

-- explicit app-role grants (0001 precedent)
grant select on table public.notifications to authenticated;
grant update (read_at) on table public.notifications to authenticated;
grant select, insert, update, delete on table public.brand_ingestions to authenticated;
grant select, insert, update, delete on table public.agent_drafts to authenticated;
grant select, insert, update, delete on table public.notifications to service_role;
grant select, insert, update, delete on table public.brand_ingestions to service_role;
grant select, insert, update, delete on table public.agent_drafts to service_role;
