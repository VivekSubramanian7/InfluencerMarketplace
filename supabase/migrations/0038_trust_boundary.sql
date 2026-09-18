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

