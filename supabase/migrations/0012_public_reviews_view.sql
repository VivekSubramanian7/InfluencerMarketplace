-- Public review surface: brand-authored reviews mapped to the reviewed
-- creator. Definer view (same pattern/justification as public_creator_stats):
-- deals RLS is participant-only, so anon storefront reads need this curated
-- projection. Exposes no brand identity, no deal internals.
create view public.public_creator_reviews
  with (security_invoker = off) as
  select d.creator_id, r.rating, r.body, r.created_at
  from public.reviews r
  join public.deals d on d.id = r.deal_id
  where r.author_id = d.brand_id;
grant select on public.public_creator_reviews to anon, authenticated;
