-- 0040: Atomicity fixes
-- Closes gap #1: saveBrandProfile 3-step write (upsert profile → insert
-- products → delete ingestions) is now a single transaction via RPC.

create or replace function public.save_brand_profile(
  p_company text,
  p_slug citext,
  p_website text,
  p_description text,
  p_notes text,
  p_outreach_template text,
  p_pref_niches text[],
  p_pref_types public.offering_type[],
  p_pref_types_other text,
  p_gsc_property text,
  p_guidelines_path text,
  p_rules_path text,
  p_products jsonb default '[]'::jsonb
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  -- 1. Upsert brand profile
  insert into public.brand_profiles (
    user_id, company, slug, website, description, notes,
    outreach_template, pref_niches, pref_types, pref_types_other,
    gsc_property, guidelines_path, rules_path
  ) values (
    v_uid, p_company, p_slug, p_website, p_description, p_notes,
    p_outreach_template, p_pref_niches, p_pref_types, p_pref_types_other,
    p_gsc_property,
    p_guidelines_path, p_rules_path
  )
  on conflict (user_id) do update set
    company = excluded.company,
    slug = excluded.slug,
    website = excluded.website,
    description = excluded.description,
    notes = excluded.notes,
    outreach_template = excluded.outreach_template,
    pref_niches = excluded.pref_niches,
    pref_types = excluded.pref_types,
    pref_types_other = excluded.pref_types_other,
    gsc_property = excluded.gsc_property,
    guidelines_path = coalesce(excluded.guidelines_path,
      (select bp.guidelines_path from public.brand_profiles bp where bp.user_id = v_uid)),
    rules_path = coalesce(excluded.rules_path,
      (select bp.rules_path from public.brand_profiles bp where bp.user_id = v_uid));

  -- 2. Insert proposed products (if any)
  if jsonb_array_length(p_products) > 0 then
    for v_row in select * from jsonb_array_elements(p_products)
    loop
      insert into public.brand_products (
        brand_id, name, url, description,
        target_age_min, target_age_max, target_gender, target_location
      ) values (
        v_uid,
        (v_row ->> 'name')::text,
        (v_row ->> 'url')::text,
        (v_row ->> 'description')::text,
        (v_row ->> 'target_age_min')::int,
        (v_row ->> 'target_age_max')::int,
        (v_row ->> 'target_gender')::text,
        (v_row ->> 'target_location')::text
      );
    end loop;
  end if;

  -- 3. Delete ingestion proposal (consumed)
  delete from public.brand_ingestions where brand_id = v_uid;
end;
$$;

revoke all on function public.save_brand_profile(
  text, citext, text, text, text, text, text[],
  public.offering_type[], text, text, text, text, jsonb
) from public;
grant execute on function public.save_brand_profile(
  text, citext, text, text, text, text, text[],
  public.offering_type[], text, text, text, text, jsonb
) to authenticated;
