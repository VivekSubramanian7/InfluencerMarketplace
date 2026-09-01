alter table public.brand_profiles
  add column if not exists pref_types_other text check (char_length(pref_types_other) <= 500);
