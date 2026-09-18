-- 0038: DB trust-boundary enforcement
-- Closes all app-only business-rule gaps found in the 2026-09-18 audit.

-- =============================================================================
-- Section 1: Text-length CHECK constraints
-- =============================================================================

-- Finding 7: brand_profiles.company — app caps at 120, DB has no limit
alter table public.brand_profiles
  add constraint brand_profiles_company_check
  check (company is null or length(company) <= 120);

-- Finding 14: reviews.body — app caps at 1000, DB has no limit
alter table public.reviews
  add constraint reviews_body_check
  check (body is null or length(body) <= 1000);

-- Finding 15: reports.reason — app caps at 2000, DB has no limit
alter table public.reports
  add constraint reports_reason_check
  check (length(reason) <= 2000);

-- Finding 16: reports.resolution — app caps at 500, DB has no limit
alter table public.reports
  add constraint reports_resolution_check
  check (resolution is null or length(resolution) <= 500);

-- Finding 19: briefs.goals — app-side offers validate at 2000 but briefs have no CHECK
alter table public.briefs
  add constraint briefs_goals_check
  check (goals is null or length(goals) <= 4000);

-- briefs.product_description
alter table public.briefs
  add constraint briefs_product_description_check
  check (product_description is null or length(product_description) <= 4000);

-- briefs.talking_points
alter table public.briefs
  add constraint briefs_talking_points_check
  check (talking_points is null or length(talking_points) <= 4000);

-- =============================================================================
-- Section 2: NOT NULL and range constraints
-- =============================================================================

-- Finding 6: brand_profiles.company — app requires non-empty, DB allows NULL.
-- Two-step: backfill any NULLs, then add NOT NULL.
update public.brand_profiles set company = 'Unnamed' where company is null or trim(company) = '';

alter table public.brand_profiles
  alter column company set not null;

-- Finding 27: offerings.price_cents — app caps at 100M (=$1M), DB only checks > 0
alter table public.offerings
  drop constraint if exists offerings_price_cents_check;

alter table public.offerings
  add constraint offerings_price_cents_check
  check (price_cents between 1 and 100000000);

-- =============================================================================
-- Section 3: Array-length constraints
-- =============================================================================

-- Finding 4: creator_profiles.niches — app caps at 8, DB has no limit
alter table public.creator_profiles
  add constraint creator_profiles_niches_check
  check (coalesce(array_length(niches, 1), 0) <= 8);

-- Finding 5: creator_profiles.languages — app caps at 5, DB has no limit
alter table public.creator_profiles
  add constraint creator_profiles_languages_check
  check (coalesce(array_length(languages, 1), 0) <= 5);

-- Finding 4 (brand side): brand_profiles.pref_niches — app caps at 8
alter table public.brand_profiles
  add constraint brand_profiles_pref_niches_check
  check (coalesce(array_length(pref_niches, 1), 0) <= 8);

-- =============================================================================
-- Section 4: Cross-column constraints
-- =============================================================================

-- Finding 20: brand_products age range — app checks min <= max, DB does not
alter table public.brand_products
  add constraint brand_products_age_range_check
  check (
    target_age_min is null
    or target_age_max is null
    or target_age_min <= target_age_max
  );

-- =============================================================================
-- Section 5: Aggregate count limits (triggers)
-- =============================================================================

-- Finding 3: brand_products — app caps at 12 per ingestion, DB has no per-brand limit.
-- Cap at 50 (generous ceiling — the app ingests 12 at a time but brands can add manually too).
create function public.validate_brand_product_count()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_count int;
begin
  select count(*) into v_count
  from public.brand_products
  where brand_id = new.brand_id;
  if v_count >= 50 then
    raise exception 'Product limit reached (max 50 per brand)';
  end if;
  return new;
end;
$$;

create trigger brand_products_count_gate
  before insert on public.brand_products
  for each row execute function public.validate_brand_product_count();

-- =============================================================================
-- Section 6: Campaign edit guard
-- =============================================================================

-- Finding 10: app blocks budget/offering_type change when pending applications exist.
-- DB has no such enforcement. A brand can call update on campaigns directly.
create function public.validate_campaign_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_pending int;
begin
  -- service role bypasses (admin tooling)
  if auth.uid() is null then
    return new;
  end if;

  if new.budget_min_cents is distinct from old.budget_min_cents
     or new.budget_max_cents is distinct from old.budget_max_cents
     or new.offering_type is distinct from old.offering_type then

    select count(*) into v_pending
    from public.campaign_applications a
    where a.campaign_id = old.id and a.status = 'pending';

    if v_pending > 0 then
      raise exception 'Cannot change budget or offering type while % pending application(s) exist — decline them first', v_pending;
    end if;
  end if;

  return new;
end;
$$;

create trigger campaigns_validate_update
  before update on public.campaigns
  for each row execute function public.validate_campaign_update();

-- =============================================================================
-- Section 7: Product delete guard
-- =============================================================================

-- Finding 11: app checks open campaigns before delete, DB just SET NULLs the FK.
-- Add a BEFORE DELETE trigger that rejects when open campaigns reference this product.
create function public.validate_brand_product_delete()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_count int;
begin
  if auth.uid() is null then
    return old; -- service role bypass
  end if;

  select count(*) into v_count
  from public.campaigns c
  where c.product_id = old.id and c.status = 'open';

  if v_count > 0 then
    raise exception 'This product is used by % open campaign(s) — close or edit the campaign first', v_count;
  end if;

  return old;
end;
$$;

create trigger brand_products_delete_gate
  before delete on public.brand_products
  for each row execute function public.validate_brand_product_delete();

-- =============================================================================
-- Section 8: Storefront completeness gate in accept_offer
-- =============================================================================

-- Finding 12: app checks storefront completeness before accept_offer(),
-- but the RPC itself does not. Direct call bypasses the gate.
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
  v_brief jsonb;
  v_has_account boolean;
  v_has_portfolio boolean;
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

  -- Storefront completeness gate (mirrors app-layer check)
  select exists(
    select 1 from public.connected_accounts a where a.creator_id = v_uid
  ) into v_has_account;
  select exists(
    select 1 from public.portfolio_items p where p.creator_id = v_uid
  ) into v_has_portfolio;
  if not v_has_account or not v_has_portfolio then
    raise exception 'Complete your storefront (add a channel and a sample) before accepting offers';
  end if;

  v_brief := jsonb_build_object(
    'goals', coalesce(v_offer.goals, v_offer.note, 'Agreed in conversation — see the thread.'),
    'product_description', coalesce(v_offer.product_description, ''),
    'talking_points', coalesce(v_offer.talking_points, '')
  );

  v_deal_id := public.create_deal(
    v_conv.brand_id, v_conv.creator_id, v_offering.id,
    v_offer.price_cents, v_brief, 'offer',
    jsonb_build_object(
      'offer_id', v_offer.id,
      'conversation_id', v_conv.id,
      'listed_price_cents', v_offering.price_cents,
      'agreed_price_cents', v_offer.price_cents),
    'accepted',
    'off_platform'::public.payment_mode
  );

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
