alter table public.campaigns
  add column if not exists visibility text not null default 'public'
  check (visibility in ('public','private'));

create table if not exists public.campaign_invites (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  invited_at timestamptz not null default now(),
  unique (campaign_id, creator_id)
);
alter table public.campaign_invites enable row level security;

create policy "brand sees own campaign invites" on public.campaign_invites
  for select to authenticated using (
    exists (select 1 from public.campaigns c where c.id = campaign_id and c.brand_id = (select auth.uid()))
    or creator_id = (select auth.uid())
  );

drop policy if exists "open campaigns readable by authenticated, owners see own" on public.campaigns;
create policy "campaigns visibility policy" on public.campaigns
  for select to authenticated using (
    (visibility = 'public' and status = 'open')
    or brand_id = (select auth.uid())
    or exists (
      select 1 from public.campaign_invites ci
      where ci.campaign_id = id and ci.creator_id = (select auth.uid())
    )
  );

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
grant select on table public.campaign_invites to authenticated;

create or replace view public.campaign_response_time as
select
  ci.id as invite_id,
  ci.campaign_id,
  ci.creator_id,
  ci.invited_at,
  c.responded_at,
  extract(epoch from (c.responded_at - ci.invited_at)) * 1000 as response_time_ms
from public.campaign_invites ci
join public.conversations c on c.id = ci.conversation_id
where c.responded_at is not null;

grant select on public.campaign_response_time to authenticated;
