-- Pre-deal messaging: brand → creator reachout invitations that become chat
-- threads on acceptance, offers negotiated inside a thread that become deals,
-- and claimable invites for influencers not on Clipline yet.
--
-- Definer-internal writes (RPCs below) that validation triggers must admit
-- set the transaction-local GUC clipline.internal = '1'. PostgREST clients
-- cannot call set_config (pg_catalog is not an exposed schema), so the flag
-- is unreachable from outside these functions.

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  -- creator_id references profiles (not creator_profiles): invite-claimed
  -- conversations are created at signup, before the creator wizard runs.
  brand_id uuid not null references public.profiles(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'invited'
    check (status in ('invited','accepted','declined')),
  invite_message text not null check (length(invite_message) between 1 and 2000),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (brand_id, creator_id)
);
alter table public.conversations enable row level security;
create index conversations_creator_idx on public.conversations (creator_id, status);

create policy "participants read conversations"
  on public.conversations for select
  using ((select auth.uid()) in (brand_id, creator_id));
create policy "brands invite creators"
  on public.conversations for insert
  with check (
    (select auth.uid()) = brand_id
    and exists (select 1 from public.profiles p
                where p.id = (select auth.uid()) and p.role = 'brand')
  );
create policy "participants update conversations"
  on public.conversations for update
  using ((select auth.uid()) in (brand_id, creator_id));

create function public.validate_conversation_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_internal boolean :=
    coalesce(current_setting('clipline.internal', true), '') = '1';
  v_creator_role public.user_role;
begin
  if new.brand_id = new.creator_id then
    raise exception 'You cannot invite yourself';
  end if;
  select role into v_creator_role from public.profiles where id = new.creator_id;
  if v_creator_role is distinct from 'creator' then
    raise exception 'Invitations can only go to creator accounts';
  end if;

  if not v_internal then
    -- reachout path: target must be a live creator, and not blocked
    if not exists (select 1 from public.creator_profiles cp
                   where cp.user_id = new.creator_id and cp.status = 'live') then
      raise exception 'This creator is not accepting invitations';
    end if;
    if exists (select 1 from public.brand_blocklist b
               where b.brand_id = new.brand_id and b.creator_id = new.creator_id) then
      raise exception 'You have blocked this creator';
    end if;
    new.status := 'invited';
    new.responded_at := null;
  end if;
  -- internal path (invite claim) may insert pre-accepted conversations

  new.created_at := now();
  return new;
end;
$$;

create trigger conversations_validate_insert
  before insert on public.conversations
  for each row execute function public.validate_conversation_insert();

create function public.validate_conversation_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return new; -- service role / admin tooling
  end if;
  if new.brand_id <> old.brand_id
     or new.creator_id <> old.creator_id
     or new.invite_message <> old.invite_message
     or new.created_at <> old.created_at then
    raise exception 'Conversation identity cannot change';
  end if;
  if v_uid = old.creator_id then
    if old.status <> 'invited' or new.status not in ('accepted','declined') then
      raise exception 'This invitation has already been answered';
    end if;
    new.responded_at := now();
  else
    raise exception 'Only the invited creator can respond';
  end if;
  return new;
end;
$$;

create trigger conversations_validate_update
  before update on public.conversations
  for each row execute function public.validate_conversation_update();

-- Messages now attach to a deal OR a conversation — exactly one.
alter table public.messages alter column deal_id drop not null;
alter table public.messages
  add column conversation_id uuid references public.conversations(id) on delete cascade,
  add constraint messages_one_parent
    check ((deal_id is null) <> (conversation_id is null));
create index messages_conversation_idx on public.messages (conversation_id)
  where conversation_id is not null;

create policy "conversation participants read messages"
  on public.messages for select
  using (exists (select 1 from public.conversations c
                 where c.id = conversation_id
                   and (select auth.uid()) in (c.brand_id, c.creator_id)));
create policy "conversation participants send messages"
  on public.messages for insert
  with check ((select auth.uid()) = sender_id
    and exists (select 1 from public.conversations c
                where c.id = conversation_id
                  and c.status = 'accepted'
                  and (select auth.uid()) in (c.brand_id, c.creator_id)));

-- Offers: a brand proposes an offering at a negotiated price inside a thread;
-- creator acceptance (accept_offer RPC) creates the deal at that price.
create table public.offers (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  offering_id uuid not null references public.offerings(id),
  price_cents bigint not null check (price_cents between 100 and 100000000),
  note text check (note is null or length(note) <= 2000),
  status text not null default 'pending'
    check (status in ('pending','accepted','declined')),
  deal_id uuid references public.deals(id),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
alter table public.offers enable row level security;
create index offers_conversation_idx on public.offers (conversation_id);
create unique index offers_one_pending_per_conversation
  on public.offers (conversation_id) where status = 'pending';

create policy "participants read offers"
  on public.offers for select
  using (exists (select 1 from public.conversations c
                 where c.id = conversation_id
                   and (select auth.uid()) in (c.brand_id, c.creator_id)));
create policy "brands send offers"
  on public.offers for insert
  with check (exists (select 1 from public.conversations c
                      where c.id = conversation_id
                        and (select auth.uid()) = c.brand_id));
create policy "participants update offers"
  on public.offers for update
  using (exists (select 1 from public.conversations c
                 where c.id = conversation_id
                   and (select auth.uid()) in (c.brand_id, c.creator_id)));

create function public.validate_offer_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_conv public.conversations;
  v_offering public.offerings;
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

  new.status := 'pending';
  new.deal_id := null;
  new.created_at := now();
  new.decided_at := null;
  return new;
end;
$$;

create trigger offers_validate_insert
  before insert on public.offers
  for each row execute function public.validate_offer_insert();

create function public.validate_offer_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_creator uuid;
begin
  if v_uid is null
     or coalesce(current_setting('clipline.internal', true), '') = '1' then
    return new; -- service role, or accept_offer finishing its transaction
  end if;
  if new.conversation_id <> old.conversation_id
     or new.offering_id <> old.offering_id
     or new.price_cents <> old.price_cents
     or new.note is distinct from old.note
     or new.created_at <> old.created_at then
    raise exception 'Offer terms cannot be edited — send a new offer';
  end if;
  select creator_id into v_creator from public.conversations c
  where c.id = old.conversation_id;
  if v_uid <> v_creator then
    raise exception 'Only the creator can respond to an offer';
  end if;
  if old.status <> 'pending' or new.status <> 'declined' then
    raise exception 'Accepting an offer goes through accept_offer';
  end if;
  new.decided_at := now();
  new.deal_id := null;
  return new;
end;
$$;

create trigger offers_validate_update
  before update on public.offers
  for each row execute function public.validate_offer_update();

-- Claimable invites for influencers not on Clipline yet. The brand shares a
-- signup link carrying the token; claiming opens an accepted conversation.
create table public.creator_invites (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.profiles(id) on delete cascade,
  contact text not null check (length(contact) between 1 and 200),
  token uuid unique not null default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending','claimed')),
  claimed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  claimed_at timestamptz
);
alter table public.creator_invites enable row level security;
create index creator_invites_brand_idx on public.creator_invites (brand_id);

create policy "brands read own invites"
  on public.creator_invites for select using ((select auth.uid()) = brand_id);
create policy "brands create own invites"
  on public.creator_invites for insert
  with check (
    (select auth.uid()) = brand_id
    and exists (select 1 from public.profiles p
                where p.id = (select auth.uid()) and p.role = 'brand')
  );
-- no update grant: claiming goes through claim_creator_invite()

-- Creator accepts a pending offer: deal is created off the offering (insert
-- trigger snapshots + validates), then the negotiated price is applied in the
-- same transaction with an audit event. validate_deal_insert stays untouched.
create function public.accept_offer(p_offer_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_offer public.offers;
  v_conv public.conversations;
  v_offering public.offerings;
  v_deal_id uuid;
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

  insert into public.deals
    (brand_id, creator_id, offering_id, offering_type, offering_title,
     price_cents, currency, revision_limit, payment_mode, status)
  values
    (v_conv.brand_id, v_conv.creator_id, v_offering.id, v_offering.type,
     v_offering.title, v_offering.price_cents, v_offering.currency,
     v_offering.revision_limit, 'off_platform', 'requested')
  returning id into v_deal_id;

  update public.deals set price_cents = v_offer.price_cents where id = v_deal_id;

  insert into public.briefs (deal_id, goals)
  values (v_deal_id,
          coalesce(v_offer.note, 'Agreed in conversation — see the thread.'));

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

revoke all on function public.accept_offer(uuid) from public;
grant execute on function public.accept_offer(uuid) to authenticated;

-- New creator signed up through a brand's invite link: mark the invite
-- claimed and open the conversation pre-accepted. Silently no-ops on bad or
-- reused tokens (nothing to leak to a guessing client).
create function public.claim_creator_invite(p_token uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_invite public.creator_invites;
begin
  if v_uid is null then return; end if;
  select * into v_invite from public.creator_invites i
  where i.token = p_token and i.status = 'pending' for update;
  if not found then return; end if;
  if v_invite.brand_id = v_uid then return; end if;
  if not exists (select 1 from public.profiles p
                 where p.id = v_uid and p.role = 'creator') then
    return;
  end if;

  update public.creator_invites
  set status = 'claimed', claimed_by = v_uid, claimed_at = now()
  where id = v_invite.id;

  perform set_config('clipline.internal', '1', true);
  insert into public.conversations
    (brand_id, creator_id, status, invite_message, responded_at)
  values
    (v_invite.brand_id, v_uid, 'accepted',
     'Joined Clipline from your invite.', now())
  on conflict (brand_id, creator_id) do nothing;
  perform set_config('clipline.internal', '', true);
end;
$$;

revoke all on function public.claim_creator_invite(uuid) from public;
grant execute on function public.claim_creator_invite(uuid) to authenticated;

-- brand-docs storage policies (bucket created in 0016). Brands own their
-- <brand_id>/ folder; creators with a deal or an accepted conversation with
-- that brand may read (the "rules for influencers" are for them).
create policy "brands upload own docs"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'brand-docs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "brands update own docs"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'brand-docs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "brands delete own docs"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'brand-docs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "brand docs readable by owner and partners"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'brand-docs'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (select 1 from public.deals d
                 where d.brand_id::text = (storage.foldername(name))[1]
                   and d.creator_id = (select auth.uid()))
      or exists (select 1 from public.conversations c
                 where c.brand_id::text = (storage.foldername(name))[1]
                   and c.creator_id = (select auth.uid())
                   and c.status = 'accepted')
    )
  );

-- explicit app-role grants (0001 precedent)
grant select, insert on table public.conversations to authenticated;
grant update (status, responded_at) on table public.conversations to authenticated;
grant select, insert on table public.offers to authenticated;
grant update (status, decided_at, deal_id) on table public.offers to authenticated;
grant select, insert on table public.creator_invites to authenticated;
grant select, insert, update, delete on table public.conversations to service_role;
grant select, insert, update, delete on table public.offers to service_role;
grant select, insert, update, delete on table public.creator_invites to service_role;
