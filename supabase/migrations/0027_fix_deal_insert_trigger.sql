-- The validate_deal_insert trigger hard-resets status to 'requested' on every
-- insert, overriding the p_initial_status passed to create_deal. This means
-- deals that should start as 'accepted' (campaign/offer paths) land at
-- 'requested' and the creator is incorrectly shown "Accept deal".
--
-- Fix: respect the clipline.internal flag (same pattern as conversations and
-- offers) so security-definer RPCs can insert with a non-default status.
-- create_deal is also replaced here to set the flag before its insert.

-- 1. Fix the insert trigger
create or replace function public.validate_deal_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_offering public.offerings;
  v_brand_role public.user_role;
  v_internal boolean :=
    coalesce(current_setting('clipline.internal', true), '') = '1';
begin
  if new.brand_id = new.creator_id then
    raise exception 'brand and creator cannot be the same user';
  end if;

  select role into v_brand_role from public.profiles where id = new.brand_id;
  if v_brand_role is distinct from 'brand' then
    raise exception 'deals can only be created by brand accounts';
  end if;

  if new.offering_id is null then
    raise exception 'deals must reference an offering';
  end if;

  select * into v_offering from public.offerings o where o.id = new.offering_id;
  if not found or not v_offering.active then
    raise exception 'offering not found or inactive';
  end if;
  if v_offering.creator_id <> new.creator_id then
    raise exception 'offering does not belong to this creator';
  end if;

  -- snapshot integrity: frozen values always come from the offering itself
  new.offering_type := v_offering.type;
  new.offering_title := v_offering.title;
  new.price_cents := v_offering.price_cents;
  new.currency := v_offering.currency;
  new.revision_limit := v_offering.revision_limit;

  -- trusted internal RPCs (create_deal with p_initial_status='accepted') may
  -- set status to 'accepted'; client inserts are always reset to 'requested'
  if not v_internal then
    new.status := 'requested';
  end if;

  new.revision_count := 0;
  new.requested_at := now();
  new.funded_at := null;
  new.accepted_at := case when new.status = 'accepted' then now() else null end;
  new.submitted_at := null;
  new.published_at := null;
  new.completed_at := null;
  new.cancelled_at := null;
  new.marked_paid_at := null;
  new.live_url := null;
  new.preview_url := null;

  return new;
end;
$$;

-- 2. Replace create_deal to set clipline.internal before the deal insert
drop function if exists public.create_deal(uuid,uuid,uuid,bigint,jsonb,text,jsonb,text);

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

  -- set flag so the trigger allows p_initial_status through
  perform set_config('clipline.internal', '1', true);
  insert into public.deals
    (brand_id, creator_id, offering_id, offering_type, offering_title,
     price_cents, currency, revision_limit, payment_mode, status)
  values
    (p_brand_id, p_creator_id, v_offering.id, v_offering.type,
     v_offering.title, p_price_cents, v_offering.currency,
     v_offering.revision_limit, 'off_platform',
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

revoke all on function public.create_deal(uuid,uuid,uuid,bigint,jsonb,text,jsonb,text) from public;
grant execute on function public.create_deal(uuid,uuid,uuid,bigint,jsonb,text,jsonb,text)
  to authenticated, service_role;
