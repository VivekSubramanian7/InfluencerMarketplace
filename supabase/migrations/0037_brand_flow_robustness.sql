-- 0037: Brand flow robustness — blocklist/status checks, barter payment mode,
-- delivery validation, slug collision helper, invite token expiry.

-- =============================================================================
-- Section 1 (1B): Fix create_deal() — add p_payment_mode as 9th parameter
-- =============================================================================
drop function if exists public.create_deal(uuid, uuid, uuid, bigint, jsonb, text, jsonb, text);

create function public.create_deal(
  p_brand_id uuid,
  p_creator_id uuid,
  p_offering_id uuid,
  p_price_cents bigint,
  p_brief jsonb,
  p_source text,
  p_source_meta jsonb default '{}',
  p_initial_status text default 'requested',
  p_payment_mode public.payment_mode default 'off_platform'
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

  -- set flag so the trigger allows p_initial_status through
  perform set_config('clipline.internal', '1', true);
  insert into public.deals
    (brand_id, creator_id, offering_id, offering_type, offering_title,
     price_cents, currency, revision_limit, payment_mode, status)
  values
    (p_brand_id, p_creator_id, v_offering.id, v_offering.type,
     v_offering.title, p_price_cents, v_offering.currency,
     v_offering.revision_limit, p_payment_mode,
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

revoke all on function public.create_deal(uuid, uuid, uuid, bigint, jsonb, text, jsonb, text, public.payment_mode) from public;
grant execute on function public.create_deal(uuid, uuid, uuid, bigint, jsonb, text, jsonb, text, public.payment_mode)
  to authenticated, service_role;

-- =============================================================================
-- Section 2 (1C): Fix accept_campaign_application() — pass barter payment mode
-- =============================================================================
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
    'accepted',
    case when v_campaign.is_barter then 'barter'::public.payment_mode
         else 'off_platform'::public.payment_mode end
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

-- =============================================================================
-- Section 3 (1D): Fix accept_offer() — pass 'off_platform' as 9th arg
-- =============================================================================
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
    'accepted',
    'off_platform'::public.payment_mode
  );

  perform set_config('clipline.internal', '1', true);
  update public.offers
  set status = 'accepted', decided_at = now(), deal_id = v_deal_id
  where id = p_offer_id;
  perform set_config('clipline.internal', '', true);

  return v_deal_id;
end;
$$;

-- =============================================================================
-- Section 4 (1A): Fix invite_to_campaign() — check blocklist + creator status
-- =============================================================================
create or replace function public.invite_to_campaign(
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

  -- reject blocked creators
  if exists (select 1 from public.brand_blocklist b
             where b.brand_id = v_uid and b.creator_id = p_creator_id) then
    raise exception 'This creator is on your blocklist';
  end if;
  -- reject inactive creators
  if not exists (select 1 from public.creator_profiles cp
                 where cp.user_id = p_creator_id and cp.status = 'live') then
    raise exception 'This creator is not accepting invitations';
  end if;

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
grant execute on function public.invite_to_campaign(uuid, uuid) to authenticated;

-- =============================================================================
-- Section 5 (1F): Add campaign_id column to offers table
-- =============================================================================
alter table public.offers
  add column if not exists campaign_id uuid references public.campaigns(id) on delete set null;
grant update (campaign_id) on table public.offers to authenticated;

-- =============================================================================
-- Section 6 (3B): Add delivery validation in transition_deal for mark_product_sent
-- =============================================================================
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

  if p_action = 'mark_product_sent' then
    if v_coupon is null and not exists (
      select 1 from public.creator_profiles cp
      where cp.user_id = v_deal.creator_id and cp.shipping_address is not null
    ) then
      raise exception 'Provide a coupon code or ensure the creator has a shipping address on file';
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

-- =============================================================================
-- Section 7 (3C): Add generate_unique_brand_slug helper function
-- =============================================================================
create or replace function public.generate_unique_brand_slug(
  p_company text,
  p_exclude_brand_id uuid default null
) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_base text;
  v_slug text;
  v_suffix int := 2;
begin
  v_base := lower(regexp_replace(p_company, '[^a-z0-9]+', '-', 'gi'));
  v_base := trim(both '-' from v_base);
  v_slug := v_base;
  loop
    if not exists (
      select 1 from public.brand_profiles bp
      where bp.slug = v_slug
        and (p_exclude_brand_id is null or bp.user_id <> p_exclude_brand_id)
    ) then
      return v_slug;
    end if;
    v_slug := v_base || '-' || v_suffix;
    v_suffix := v_suffix + 1;
    if v_suffix > 999 then
      return v_base || '-' || substr(gen_random_uuid()::text, 1, 8);
    end if;
  end loop;
end;
$$;

grant execute on function public.generate_unique_brand_slug(text, uuid) to authenticated, service_role;

-- =============================================================================
-- Section 8 (4A): Token expiration check in claim_creator_invite
-- =============================================================================
create or replace function public.claim_creator_invite(p_token uuid)
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
  if v_invite.created_at < now() - interval '30 days' then
    return; -- expired
  end if;
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

revoke all on function public.claim_creator_invite(uuid) from public;
grant execute on function public.claim_creator_invite(uuid) to authenticated;
