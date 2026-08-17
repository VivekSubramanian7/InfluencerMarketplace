-- public reads only surface LIVE creators' content; owners always see their own.
-- Closes anon REST enumeration of draft/suspended creators' catalog.
drop policy "portfolio public" on public.portfolio_items;
create policy "portfolio public for live creators"
  on public.portfolio_items for select
  using (
    exists (select 1 from public.creator_profiles cp
            where cp.user_id = creator_id and cp.status = 'live')
    or (select auth.uid()) = creator_id
  );

drop policy "active offerings public, owners see own" on public.offerings;
create policy "active offerings public for live creators, owners see own"
  on public.offerings for select
  using (
    (active = true and exists (select 1 from public.creator_profiles cp
                               where cp.user_id = creator_id and cp.status = 'live'))
    or (select auth.uid()) = creator_id
  );
