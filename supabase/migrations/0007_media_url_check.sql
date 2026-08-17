-- defense in depth: media URLs must be http(s) even if app-level validation
-- (parseMediaUrl) is bypassed via direct REST calls
alter table public.portfolio_items
  add constraint portfolio_media_url_scheme check (media_url ~* '^https?://');
