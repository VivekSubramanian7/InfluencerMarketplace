-- Admin access rides on RLS, not the service-role key (spec: admin module).
-- is_admin() is SECURITY DEFINER so policies can check profiles.role without
-- recursive RLS evaluation on profiles.

create function public.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create policy "admins read all deals"
  on public.deals for select to authenticated
  using (public.is_admin());

create policy "admins read all briefs"
  on public.briefs for select to authenticated
  using (public.is_admin());

create policy "admins read all deal events"
  on public.deal_events for select to authenticated
  using (public.is_admin());

create policy "admins read all messages"
  on public.messages for select to authenticated
  using (public.is_admin());

create policy "admins read all creator profiles"
  on public.creator_profiles for select to authenticated
  using (public.is_admin());

create policy "admins update creator profiles"
  on public.creator_profiles for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "admins read all reports"
  on public.reports for select to authenticated
  using (public.is_admin());

create policy "admins resolve reports"
  on public.reports for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- reports.update was never granted to authenticated; grant it now (RLS gates rows)
grant update on table public.reports to authenticated;
