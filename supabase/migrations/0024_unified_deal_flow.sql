-- Unified deal flow: 8-state machine, conversation-linked messaging,
-- system messages, offer brief fields, create_deal RPC.

-- ============================================================
-- 1. Backfill existing deals out of removed states
-- ============================================================
update public.deals set status = 'requested' where status = 'funded';
update public.deals set status = 'accepted' where status = 'in_production';

-- 2. Add conversation_id to deals
-- ============================================================
alter table public.deals
  add column conversation_id uuid references public.conversations(id);

-- Backfill: for every deal, find or create the conversation
do $$
declare
  r record;
  v_conv_id uuid;
begin
  for r in
    select d.id as deal_id, d.brand_id, d.creator_id
    from public.deals d
    where d.conversation_id is null
  loop
    select id into v_conv_id
    from public.conversations c
    where c.brand_id = r.brand_id and c.creator_id = r.creator_id;

    if v_conv_id is null then
      perform set_config('clipline.internal', '1', true);
      insert into public.conversations (brand_id, creator_id, status, invite_message, responded_at)
      values (r.brand_id, r.creator_id, 'accepted', 'Conversation created for existing deal.', now())
      returning id into v_conv_id;
      perform set_config('clipline.internal', '', true);
    end if;

    update public.deals set conversation_id = v_conv_id where id = r.deal_id;
  end loop;
end;
$$;

-- 3. Messages: add kind, deal_id_ref, make sender_id nullable
-- ============================================================
alter table public.messages
  add column kind text not null default 'message'
    check (kind in ('message', 'system')),
  add column deal_id_ref uuid references public.deals(id);

alter table public.messages
  alter column sender_id drop not null;

-- Drop XOR constraint before backfill (we drop the column after anyway)
alter table public.messages drop constraint if exists messages_one_parent;

-- Backfill: move deal messages to conversations
do $$
declare
  r record;
  v_conv_id uuid;
begin
  for r in
    select m.id as msg_id, m.deal_id, d.brand_id, d.creator_id
    from public.messages m
    join public.deals d on d.id = m.deal_id
    where m.deal_id is not null and m.conversation_id is null
  loop
    select id into v_conv_id
    from public.conversations c
    where c.brand_id = r.brand_id and c.creator_id = r.creator_id;

    if v_conv_id is null then
      perform set_config('clipline.internal', '1', true);
      insert into public.conversations (brand_id, creator_id, status, invite_message, responded_at)
      values (r.brand_id, r.creator_id, 'accepted', 'Conversation created for message migration.', now())
      returning id into v_conv_id;
      perform set_config('clipline.internal', '', true);
    end if;

    update public.messages
    set conversation_id = v_conv_id, deal_id_ref = r.deal_id
    where id = r.msg_id;
  end loop;
end;
$$;

-- Drop old policies, index, then column
drop policy if exists "participants read messages" on public.messages;
drop policy if exists "participants send messages" on public.messages;
drop index if exists public.messages_deal_idx;
alter table public.messages drop column if exists deal_id;

-- Update RLS: deal participants can read messages via conversation
-- (existing conversation participant policies already cover this since
-- messages now all route through conversation_id)

-- 4. Offer brief fields
-- ============================================================
alter table public.offers
  add column goals text check (length(goals) between 1 and 2000),
  add column product_description text check (length(product_description) <= 2000),
  add column talking_points text check (length(talking_points) <= 2000);

-- Copy existing note into goals for any offers that had a note
update public.offers set goals = note where note is not null and goals is null;

-- 5. Re-seed deal_transitions for 8-state machine
-- ============================================================
truncate table public.deal_transitions;
insert into public.deal_transitions (from_status, action, to_status, actor_role, mode) values
  ('requested', 'accept', 'accepted', 'creator', null),
  ('requested', 'decline', 'cancelled', 'creator', null),
  ('requested', 'expire_accept', 'cancelled', 'system', null),
  ('requested', 'cancel', 'cancelled', 'brand', null),
  ('accepted', 'submit_preview', 'submitted', 'creator', null),
  ('accepted', 'cancel', 'cancelled', 'brand', null),
  ('accepted', 'cancel', 'cancelled', 'creator', null),
  ('submitted', 'request_revision', 'revision_requested', 'brand', null),
  ('submitted', 'approve_preview', 'submitted', 'brand', null),
  ('submitted', 'mark_published', 'published', 'creator', null),
  ('revision_requested', 'submit_preview', 'submitted', 'creator', null),
  ('published', 'approve', 'completed', 'brand', null),
  ('published', 'auto_approve', 'completed', 'system', null),
  ('accepted', 'dispute', 'disputed', 'brand', null),
  ('accepted', 'dispute', 'disputed', 'creator', null),
  ('submitted', 'dispute', 'disputed', 'brand', null),
  ('submitted', 'dispute', 'disputed', 'creator', null),
  ('revision_requested', 'dispute', 'disputed', 'brand', null),
  ('revision_requested', 'dispute', 'disputed', 'creator', null),
  ('published', 'dispute', 'disputed', 'brand', null),
  ('published', 'dispute', 'disputed', 'creator', null),
  ('disputed', 'resolve_release', 'completed', 'admin', null),
  ('disputed', 'resolve_refund', 'cancelled', 'admin', null);

-- 6. Update transition_deal RPC: system messages, approve_preview,
--    last_revision_note in RPC, remove funded_at timestamp
-- ============================================================
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

  update public.deals set
    status = v_transition.to_status,
    revision_count = revision_count
      + (case when p_action = 'request_revision' then 1 else 0 end),
    preview_url = case when p_action = 'submit_preview' then v_preview else preview_url end,
    live_url = case when p_action = 'mark_published' then v_live else live_url end,
    last_revision_note = case when p_action = 'request_revision' then v_note else last_revision_note end,
    accepted_at  = case when v_transition.to_status = 'accepted'  then now() else accepted_at end,
    submitted_at = case when v_transition.to_status = 'submitted' then now() else submitted_at end,
    published_at = case when v_transition.to_status = 'published' then now() else published_at end,
    completed_at = case when v_transition.to_status = 'completed' then now() else completed_at end,
    cancelled_at = case when v_transition.to_status = 'cancelled' then now() else cancelled_at end
  where id = p_deal_id
  returning * into v_deal;

  insert into public.deal_events (deal_id, actor, action, from_status, to_status, metadata)
  values (p_deal_id, v_uid, p_action, v_transition.from_status, v_transition.to_status,
          coalesce(p_payload, '{}'::jsonb));

  -- System message in the conversation thread
  if v_deal.conversation_id is not null then
    v_sys_msg := case p_action
      when 'accept' then 'Creator accepted the deal'
      when 'decline' then 'Creator declined the deal'
      when 'submit_preview' then 'Preview submitted: ' || coalesce(v_preview, '')
      when 'approve_preview' then 'Brand approved the preview — clear to publish'
      when 'request_revision' then 'Brand requested changes: ' || coalesce(v_note, '(no note)')
      when 'mark_published' then 'Content published: ' || coalesce(v_live, '')
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

revoke all on function public.transition_deal(uuid, text, text, jsonb) from public;
grant execute on function public.transition_deal(uuid, text, text, jsonb)
  to authenticated, service_role;

-- 7. Update mark_deal_paid: remove in_production from payable states
-- ============================================================
drop function if exists public.mark_deal_paid(uuid);

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
  if v_deal.status not in ('accepted','submitted',
                           'revision_requested','published','completed') then
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

revoke all on function public.mark_deal_paid(uuid) from public;
grant execute on function public.mark_deal_paid(uuid) to authenticated;

-- 8. Update deal timers: remove 'funded' from expire query
-- ============================================================
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

-- 9. create_deal RPC
-- ============================================================
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

  select * into v_offering from public.offerings o
  where o.id = p_offering_id;
  if not found or not v_offering.active then
    raise exception 'offering not found or inactive';
  end if;

  -- auto-fill product description from brand's products if not provided
  if p_brief->>'product_description' is null or p_brief->>'product_description' = '' then
    select string_agg(bp.name, ', ' order by bp.name)
    into v_product_desc
    from public.brand_products bp
    where bp.brand_id = p_brand_id;
  end if;

  insert into public.deals
    (brand_id, creator_id, offering_id, offering_type, offering_title,
     price_cents, currency, revision_limit, payment_mode, status,
     accepted_at)
  values
    (p_brand_id, p_creator_id, v_offering.id, v_offering.type,
     v_offering.title, p_price_cents, v_offering.currency,
     v_offering.revision_limit, 'off_platform',
     p_initial_status::public.deal_status,
     case when p_initial_status = 'accepted' then now() else null end)
  returning id into v_deal_id;

  insert into public.briefs (deal_id, goals, product_description, talking_points)
  values (
    v_deal_id,
    p_brief->>'goals',
    coalesce(nullif(p_brief->>'product_description', ''), v_product_desc),
    nullif(p_brief->>'talking_points', '')
  );

  -- find or create conversation
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

revoke all on function public.create_deal(uuid,uuid,uuid,bigint,jsonb,text,jsonb,text) from public;
grant execute on function public.create_deal(uuid,uuid,uuid,bigint,jsonb,text,jsonb,text)
  to authenticated, service_role;

-- 10. Refactor accept_offer to use create_deal
-- ============================================================
create or replace function public.accept_offer(p_offer_id uuid)
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

-- 11. Refactor accept_campaign_application to use create_deal
-- ============================================================
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

  update public.campaign_applications
  set status = 'accepted', deal_id = v_deal_id
  where id = p_application_id;

  return v_deal_id;
end;
$$;

-- 12. RLS policy for system messages (sender_id is null)
-- ============================================================
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
