-- Distributed unread indicators: per-feature "last seen" cursors replace
-- the centralized notifications table.

create table public.feature_cursors (
  user_id uuid not null references public.profiles(id) on delete cascade,
  feature text not null check (length(feature) between 1 and 30),
  seen_at timestamptz not null default now(),
  primary key (user_id, feature)
);
alter table public.feature_cursors enable row level security;

create policy "users read own cursors"
  on public.feature_cursors for select
  using ((select auth.uid()) = user_id);
create policy "users upsert own cursors"
  on public.feature_cursors for insert
  with check ((select auth.uid()) = user_id);
create policy "users update own cursors"
  on public.feature_cursors for update
  using ((select auth.uid()) = user_id);

grant select, insert, update on table public.feature_cursors to authenticated;
grant select, insert, update, delete on table public.feature_cursors to service_role;

-- Drop the notifications table. brand_ingestions and agent_drafts (same
-- migration 0019) stay — only notifications is removed.
drop policy if exists "users read own notifications" on public.notifications;
drop policy if exists "users mark own notifications read" on public.notifications;
drop index if exists notifications_unread_idx;
drop index if exists notifications_user_idx;
drop table if exists public.notifications;
