alter table public.offers
  add column if not exists campaign_id uuid references public.campaigns(id) on delete set null;

create index if not exists offers_campaign_id_idx on public.offers(campaign_id);

create or replace function public.validate_offer_insert()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_conv public.conversations;
  v_offering public.offerings;
  v_max bigint;
begin
  select * into v_conv from public.conversations c where c.id = new.conversation_id;
  if not found or v_conv.status <> 'accepted' then
    raise exception 'Offers can only be sent in an accepted conversation';
  end if;
  if auth.uid() is distinct from v_conv.brand_id then
    raise exception 'Only the brand can send an offer';
  end if;
  select * into v_offering from public.offerings o where o.id = new.offering_id;
  if not found or not v_offering.active then
    raise exception 'That offering is no longer available';
  end if;
  if v_offering.creator_id <> v_conv.creator_id then
    raise exception 'Offering does not belong to this creator';
  end if;

  if new.campaign_id is not null then
    select budget_max_cents into v_max from public.campaigns where id = new.campaign_id;
    if v_max is not null and new.price_cents > v_max then
      raise exception 'Offer exceeds the campaign budget cap of % cents', v_max;
    end if;
  end if;

  new.status := 'pending';
  new.deal_id := null;
  new.created_at := now();
  new.decided_at := null;
  return new;
end;
$$;
