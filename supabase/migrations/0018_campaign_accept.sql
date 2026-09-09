-- Fix the campaign dead-end: accepting an application now creates the deal
-- at the creator's proposed price, with the brief built from the campaign
-- and the pitch. Same negotiated-price pattern as accept_offer (0017):
-- insert through validate_deal_insert, then apply the agreed price + audit.

alter table public.campaign_applications
  add column deal_id uuid references public.deals(id);

create function public.accept_campaign_application(p_application_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_app public.campaign_applications;
  v_campaign public.campaigns;
  v_offering public.offerings;
  v_deal_id uuid;
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

  -- the deal must reference a real offering; pick the creator's cheapest
  -- active offering of the campaign's format
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

  insert into public.briefs (deal_id, goals, talking_points)
  values (v_deal_id,
          v_campaign.title || E'\n\n' || v_campaign.description,
          v_app.pitch);

  insert into public.deal_events (deal_id, actor, action, metadata)
  values (v_deal_id, v_uid, 'campaign_accepted',
          jsonb_build_object(
            'campaign_id', v_campaign.id,
            'application_id', v_app.id,
            'listed_price_cents', v_offering.price_cents,
            'agreed_price_cents', v_app.proposed_price_cents));

  -- brand path of validate_campaign_application_update allows pending→accepted
  update public.campaign_applications
  set status = 'accepted', deal_id = v_deal_id
  where id = p_application_id;

  return v_deal_id;
end;
$$;

revoke all on function public.accept_campaign_application(uuid) from public;
grant execute on function public.accept_campaign_application(uuid) to authenticated;
