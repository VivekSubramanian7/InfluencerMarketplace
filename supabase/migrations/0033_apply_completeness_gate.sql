-- Gate campaign applications on storefront completeness + optional platform requirements.

alter table public.campaigns
  add column if not exists platforms text[] not null default '{}';

create or replace function public.validate_campaign_application_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_campaign public.campaigns;
  v_has_account boolean;
  v_has_portfolio boolean;
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

  select exists(
    select 1 from public.connected_accounts a where a.creator_id = new.creator_id
  ) into v_has_account;
  select exists(
    select 1 from public.portfolio_items p where p.creator_id = new.creator_id
  ) into v_has_portfolio;
  if not v_has_account or not v_has_portfolio then
    raise exception 'Storefront incomplete: add a channel and a sample before applying';
  end if;

  if coalesce(array_length(v_campaign.platforms, 1), 0) > 0 and not exists (
    select 1 from public.connected_accounts a
    where a.creator_id = new.creator_id
      and a.platform::text = any (v_campaign.platforms)
  ) then
    raise exception 'This campaign requires a connected account on one of its target platforms';
  end if;

  new.status := 'pending';
  new.created_at := now();
  return new;
end;
$$;
