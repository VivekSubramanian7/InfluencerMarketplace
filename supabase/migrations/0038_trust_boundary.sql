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
