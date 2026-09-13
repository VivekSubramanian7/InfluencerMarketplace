-- 0036: MVP transcript gap-fill — per-product targeting, campaign brief fields,
-- creator demographics, coupon code, 24h auto-approve, shipping snapshot.

-- A1. Per-product targeting
alter table public.brand_products
  add column target_age_min int check (target_age_min is null or target_age_min between 13 and 100),
  add column target_age_max int check (target_age_max is null or target_age_max between 13 and 100),
  add column target_gender text check (target_gender is null or target_gender in ('male','female','all')),
  add column target_location text check (target_location is null or length(target_location) <= 200);

grant update (name, url, description, target_age_min, target_age_max, target_gender, target_location)
  on table public.brand_products to authenticated;

create policy "brands update own products"
  on public.brand_products for update
  using ((select auth.uid()) = brand_id);

-- A2. Campaign brief fields
alter table public.campaigns
  add column product_id uuid references public.brand_products(id) on delete set null,
  add column buyer_persona text check (buyer_persona is null or length(buyer_persona) <= 1000),
  add column target_location text check (target_location is null or length(target_location) <= 200),
  add column target_language text check (target_language is null or length(target_language) <= 100),
  add column content_form text check (content_form is null or length(content_form) <= 100),
  add column script text check (script is null or length(script) <= 5000),
  add column duration_seconds int check (duration_seconds is null or duration_seconds > 0),
  add column is_barter boolean not null default false,
  add column expected_live_date date;

grant update (product_id, buyer_persona, target_location, target_language,
              content_form, script, duration_seconds, is_barter, expected_live_date)
  on table public.campaigns to authenticated;

-- Relax budget check for barter campaigns (budget can be 0)
alter table public.campaigns drop constraint if exists campaigns_budget_min_cents_check;
alter table public.campaigns add constraint campaigns_budget_min_cents_check
  check (budget_min_cents >= 0);

-- A3. Creator profile demographics
alter table public.creator_profiles
  add column shipping_address text check (shipping_address is null or length(shipping_address) <= 500),
  add column interested_in_paid boolean not null default false,
  add column age int check (age is null or age between 13 and 120),
  add column gender text check (gender is null or length(gender) <= 30),
  add column city text check (city is null or length(city) <= 100);

-- A4. Deal coupon + address snapshot
alter table public.deals
  add column coupon_code text check (coupon_code is null or length(coupon_code) <= 200),
  add column shipping_address_snapshot text check (shipping_address_snapshot is null or length(shipping_address_snapshot) <= 500);

-- A5. Brand GSC property
alter table public.brand_profiles
  add column gsc_property text check (gsc_property is null or length(gsc_property) <= 500);

-- A6. Auto-approve: 5 days → 24 hours
create or replace function public.run_deal_timers() returns integer
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
      and published_at < now() - interval '24 hours'
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

-- A7. transition_deal: snapshot address on accept, store coupon on mark_product_sent, fix auto_approve msg
drop function if exists public.transition_deal(uuid, text, text, jsonb);

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
  v_coupon text := nullif(p_payload->>'coupon_code', '');
  v_shipping_addr text;
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

  -- Snapshot creator shipping address on accept
  if p_action = 'accept' then
    select cp.shipping_address into v_shipping_addr
    from public.creator_profiles cp
    where cp.user_id = v_deal.creator_id;
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
    coupon_code = case when p_action = 'mark_product_sent' and v_coupon is not null then v_coupon else coupon_code end,
    shipping_address_snapshot = case when p_action = 'accept' then v_shipping_addr else shipping_address_snapshot end,
    accepted_at  = case when v_transition.to_status = 'accepted'  then now() else accepted_at end,
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
      when 'mark_product_sent' then
        case when v_coupon is not null
          then 'Brand sent coupon code: ' || v_coupon
          else 'Brand marked the product as sent'
        end
      when 'mark_product_received' then 'Creator marked the product as received'
      when 'submit_preview' then 'Preview submitted: ' || coalesce(v_preview, '')
      when 'approve_preview' then 'Brand approved the preview — clear to publish'
      when 'request_revision' then 'Brand requested changes: ' || coalesce(v_note, '(no note)')
      when 'mark_published' then 'Content published: ' || coalesce(v_live, '') || ' — awaiting brand approval'
      when 'approve' then 'Brand approved — deal complete'
      when 'auto_approve' then 'Auto-approved after 24 hours'
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

revoke all on function public.transition_deal(uuid, text, text, jsonb) from public;
grant execute on function public.transition_deal(uuid, text, text, jsonb)
  to authenticated, service_role;

-- A8. accept_campaign_application: set preview_due_at from expected_live_date
create or replace function public.accept_campaign_application(p_application_id uuid)
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

  -- Set preview deadline from campaign expected_live_date
  if v_campaign.expected_live_date is not null then
    update public.deals
    set preview_due_at = v_campaign.expected_live_date::timestamptz
    where id = v_deal_id;
  end if;

  update public.campaign_applications
  set status = 'accepted', deal_id = v_deal_id
  where id = p_application_id;

  return v_deal_id;
end;
$$;

revoke all on function public.accept_campaign_application(uuid) from public;
grant execute on function public.accept_campaign_application(uuid) to authenticated;
