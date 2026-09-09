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
