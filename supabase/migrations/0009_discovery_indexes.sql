-- Discovery search/filter indexes (Phase 2 final-review prep note).
-- pg_trgm goes into the extensions schema (advisor rule 0014).
create extension if not exists pg_trgm with schema extensions;

create index creator_profiles_status_idx on public.creator_profiles (status);
create index creator_profiles_niches_gin on public.creator_profiles using gin (niches);
create index creator_profiles_handle_trgm on public.creator_profiles
  using gin (handle extensions.gin_trgm_ops);
create index creator_profiles_bio_trgm on public.creator_profiles
  using gin (bio extensions.gin_trgm_ops);
