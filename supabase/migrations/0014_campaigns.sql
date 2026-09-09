create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (length(title) between 1 and 80),
  description text not null check (length(description) between 1 and 2000),
  offering_type public.offering_type not null,
  budget_min_cents bigint not null check (budget_min_cents > 0),
  budget_max_cents bigint not null check (budget_max_cents >= budget_min_cents),
  currency text not null default 'usd',
  apply_by date,
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now()
);
alter table public.campaigns enable row level security;
create index campaigns_brand_idx on public.campaigns (brand_id, status);
create index campaigns_open_idx on public.campaigns (status, created_at desc);

create policy "open campaigns readable by authenticated, owners see own"
  on public.campaigns for select to authenticated
  using (status = 'open' or (select auth.uid()) = brand_id);
create policy "brands create own campaigns"
  on public.campaigns for insert
  with check (
    (select auth.uid()) = brand_id
    and status = 'open'
    and exists (select 1 from public.profiles p
                where p.id = (select auth.uid()) and p.role = 'brand')
  );
create policy "brands update own campaigns"
  on public.campaigns for update
  using ((select auth.uid()) = brand_id)
  with check ((select auth.uid()) = brand_id);

create table public.campaign_applications (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  creator_id uuid not null references public.creator_profiles(user_id) on delete cascade,
  pitch text not null check (length(pitch) between 1 and 2000),
  proposed_price_cents bigint not null check (proposed_price_cents > 0),
  status text not null default 'pending'
    check (status in ('pending','accepted','declined','withdrawn')),
  created_at timestamptz not null default now(),
  unique (campaign_id, creator_id)
);
alter table public.campaign_applications enable row level security;
create index campaign_applications_campaign_idx on public.campaign_applications (campaign_id);
create index campaign_applications_creator_idx on public.campaign_applications (creator_id);

create policy "applicant and campaign owner read applications"
  on public.campaign_applications for select
  using (
    (select auth.uid()) = creator_id
    or exists (select 1 from public.campaigns c
               where c.id = campaign_id and c.brand_id = (select auth.uid()))
  );
create policy "creators apply as themselves"
  on public.campaign_applications for insert
  with check (
    (select auth.uid()) = creator_id
    and exists (select 1 from public.profiles p
                where p.id = (select auth.uid()) and p.role = 'creator')
  );
create policy "applicant and campaign owner update applications"
  on public.campaign_applications for update
  using (
    (select auth.uid()) = creator_id
    or exists (select 1 from public.campaigns c
               where c.id = campaign_id and c.brand_id = (select auth.uid()))
  )
  with check (
    (select auth.uid()) = creator_id
    or exists (select 1 from public.campaigns c
               where c.id = campaign_id and c.brand_id = (select auth.uid()))
  );

-- application-creation integrity (validate_deal_insert precedent):
-- campaign must be open and inside its window; privileged columns reset
create function public.validate_campaign_application_insert()
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

  new.status := 'pending';
  new.created_at := now();
  return new;
end;
$$;

create trigger campaign_applications_validate_insert
  before insert on public.campaign_applications
  for each row execute function public.validate_campaign_application_insert();

-- application-update integrity: applicants may edit their pitch/price and
-- withdraw while pending; the campaign's brand may accept or decline while
-- pending; identity columns never change. Service role (auth.uid() null)
-- bypasses for admin tooling.
create function public.validate_campaign_application_update()
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

create trigger campaign_applications_validate_update
  before update on public.campaign_applications
  for each row execute function public.validate_campaign_application_update();

-- explicit app-role grants (see 0001 note): default ACL gives app roles no DML.
-- Updates are column-limited (0001 precedent): identity/created_at stay frozen
-- at the grant level; triggers enforce the business transitions.
grant select on table public.campaigns to authenticated;
grant insert on table public.campaigns to authenticated;
grant update (title, description, offering_type, budget_min_cents,
              budget_max_cents, apply_by, status)
  on table public.campaigns to authenticated;
grant select, insert on table public.campaign_applications to authenticated;
grant update (pitch, proposed_price_cents, status)
  on table public.campaign_applications to authenticated;
grant select, insert, update, delete on table public.campaigns to service_role;
grant select, insert, update, delete on table public.campaign_applications to service_role;
