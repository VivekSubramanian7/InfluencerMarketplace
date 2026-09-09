-- Standardize brief population across all deal creation paths.
-- accept_offer: populate product_description from brand_products.
-- accept_campaign_application: populate product_description from brand_products.

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
  v_product_desc text;
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

  -- auto-fill product description from brand's products
  select string_agg(bp.name, ', ' order by bp.name)
  into v_product_desc
  from public.brand_products bp
  where bp.brand_id = v_conv.brand_id;

  insert into public.deals
    (brand_id, creator_id, offering_id, offering_type, offering_title,
     price_cents, currency, revision_limit, payment_mode, status)
  values
    (v_conv.brand_id, v_conv.creator_id, v_offering.id, v_offering.type,
     v_offering.title, v_offering.price_cents, v_offering.currency,
     v_offering.revision_limit, 'off_platform', 'requested')
  returning id into v_deal_id;

  update public.deals set price_cents = v_offer.price_cents where id = v_deal_id;

  insert into public.briefs (deal_id, goals, product_description)
  values (v_deal_id,
          coalesce(v_offer.note, 'Agreed in conversation — see the thread.'),
          v_product_desc);

  insert into public.deal_events (deal_id, actor, action, metadata)
  values (v_deal_id, v_uid, 'offer_accepted',
          jsonb_build_object(
            'offer_id', v_offer.id,
            'conversation_id', v_conv.id,
            'listed_price_cents', v_offering.price_cents,
            'agreed_price_cents', v_offer.price_cents));

  perform set_config('clipline.internal', '1', true);
  update public.offers
  set status = 'accepted', decided_at = now(), deal_id = v_deal_id
  where id = p_offer_id;
  perform set_config('clipline.internal', '', true);

  return v_deal_id;
end;
$$;


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
  v_product_desc text;
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
    raise exception 'This creator has no active % offering — ask them to add one, or book another format from their storefront',
      v_campaign.offering_type;
  end if;

  -- auto-fill product description from brand's products
  select string_agg(bp.name, ', ' order by bp.name)
  into v_product_desc
  from public.brand_products bp
  where bp.brand_id = v_campaign.brand_id;

  insert into public.deals
    (brand_id, creator_id, offering_id, offering_type, offering_title,
     price_cents, currency, revision_limit, payment_mode, status)
  values
    (v_campaign.brand_id, v_app.creator_id, v_offering.id, v_offering.type,
     v_offering.title, v_offering.price_cents, v_offering.currency,
     v_offering.revision_limit, 'off_platform', 'requested')
  returning id into v_deal_id;

  update public.deals
  set price_cents = v_app.proposed_price_cents
  where id = v_deal_id;

  insert into public.briefs (deal_id, goals, product_description, talking_points)
  values (v_deal_id,
          v_campaign.title || E'\n\n' || v_campaign.description,
          v_product_desc,
          v_app.pitch);

  insert into public.deal_events (deal_id, actor, action, metadata)
  values (v_deal_id, v_uid, 'campaign_accepted',
          jsonb_build_object(
            'campaign_id', v_campaign.id,
            'application_id', v_app.id,
            'listed_price_cents', v_offering.price_cents,
            'agreed_price_cents', v_app.proposed_price_cents));

  update public.campaign_applications
  set status = 'accepted', deal_id = v_deal_id
  where id = p_application_id;

  return v_deal_id;
end;
$$;
