-- Anti-ghosting timers (spec: 72h accept deadline, 5-day auto-approve).
-- Runs via pg_cron as postgres (auth.uid() is null -> 'system' actor rules apply).
-- Idempotent: driven purely by status + timestamps; per-deal errors are
-- swallowed so one bad row never blocks the sweep.

create extension if not exists pg_cron;

create function public.run_deal_timers() returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select id from public.deals
    where status in ('requested','funded')
      and requested_at < now() - interval '72 hours'
  loop
    begin
      perform public.transition_deal(r.id, 'expire_accept', 'system');
      n := n + 1;
    exception when others then
      null; -- logged in deal_events only on success; sweep continues
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

  return n;
end;
$$;

revoke all on function public.run_deal_timers() from public;
grant execute on function public.run_deal_timers() to service_role;

select cron.schedule('deal-timers', '*/15 * * * *', 'select public.run_deal_timers()');
