-- Add optional decline reason so brands can give feedback on rejected applications.
-- The trigger must also allow brands to set this column during the decline transition.

alter table public.campaign_applications
  add column decline_reason text check (decline_reason is null or length(decline_reason) <= 500);

-- Rebuild the update trigger to allow brands to set decline_reason when declining.
create or replace function public.validate_campaign_application_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_brand uuid;
begin
  if v_uid is null then
    return new;
  end if;

  if new.campaign_id <> old.campaign_id
     or new.creator_id <> old.creator_id
     or new.created_at <> old.created_at then
    raise exception 'Application identity cannot change';
  end if;

  select brand_id into v_brand from public.campaigns c where c.id = old.campaign_id;

  if v_uid = old.creator_id then
    if old.status <> 'pending' then
      raise exception 'Only pending applications can be changed';
    end if;
    if new.status not in ('pending','withdrawn') then
      raise exception 'Creators can only withdraw an application';
    end if;
  elsif v_uid = v_brand then
    if new.pitch <> old.pitch
       or new.proposed_price_cents <> old.proposed_price_cents then
      raise exception 'Brands cannot edit an application';
    end if;
    if old.status <> 'pending' or new.status not in ('accepted','declined') then
      raise exception 'Only pending applications can be accepted or declined';
    end if;
  else
    raise exception 'Not allowed';
  end if;

  return new;
end;
$$;

grant update (pitch, proposed_price_cents, status, decline_reason)
  on table public.campaign_applications to authenticated;
