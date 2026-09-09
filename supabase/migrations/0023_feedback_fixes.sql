-- Feedback workspace fixes: offering gate, revision notes, waitlist status

alter table public.creator_profiles
  drop constraint if exists creator_profiles_status_check;

alter table public.creator_profiles
  add constraint creator_profiles_status_check
  check (status in ('draft','live','suspended','waitlisted'));

alter table public.deals
  add column if not exists last_revision_note text
  check (last_revision_note is null or length(last_revision_note) between 1 and 2000);

create or replace function public.validate_campaign_application_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_campaign public.campaigns;
begin
  select * into v_campaign from public.campaigns c where c.id = new.campaign_id;
  if not found or v_campaign.status <> 'open' then
    raise exception 'This campaign is not open for applications';
  end if;
  if v_campaign.apply_by is not null and v_campaign.apply_by < current_date then
    raise exception 'The application window for this campaign has closed';
  end if;
  if v_campaign.brand_id = new.creator_id then
    raise exception 'You cannot apply to your own campaign';
  end if;
  if not exists (
    select 1 from public.offerings o
    where o.creator_id = new.creator_id
      and o.type = v_campaign.offering_type
      and o.active
  ) then
    raise exception 'This campaign needs an active % offering — add one, or book another format',
      v_campaign.offering_type;
  end if;

  new.status := 'pending';
  new.created_at := now();
  return new;
end;
$$;
