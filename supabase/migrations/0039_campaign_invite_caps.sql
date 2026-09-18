-- 0039: Correct business rules for campaign and invite caps
-- 1. One campaign per brand per calendar month
-- 2. Max 5 invites per campaign (not 200)

-- =============================================================================
-- Section 1: Per-brand monthly campaign limit (trigger)
-- =============================================================================

create function public.validate_campaign_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_count int;
begin
  if auth.uid() is null then
    return new; -- service role bypass
  end if;

  select count(*) into v_count
  from public.campaigns
  where brand_id = new.brand_id
    and date_trunc('month', created_at) = date_trunc('month', now());

  if v_count >= 1 then
    raise exception 'You can only create 1 campaign per month';
  end if;

  return new;
end;
$$;

create trigger campaigns_insert_gate
  before insert on public.campaigns
  for each row execute function public.validate_campaign_insert();

-- =============================================================================
-- Section 2: Reduce per-campaign invite cap from 200 to 5
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
  v_invite_count int;
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

  -- Per-campaign invite cap (max 5)
  select count(*) into v_invite_count
  from public.campaign_invites ci
  where ci.campaign_id = p_campaign_id;
  if v_invite_count >= 5 then
    raise exception 'Campaign invite limit reached (max 5 per campaign)';
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
