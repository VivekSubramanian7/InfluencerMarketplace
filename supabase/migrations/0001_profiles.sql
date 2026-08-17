create extension if not exists citext;

create type public.user_role as enum ('creator','brand','admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'brand',
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "profiles are publicly readable"
  on public.profiles for select using (true);
create policy "users update own profile"
  on public.profiles for update using ((select auth.uid()) = id);

create table public.creator_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  handle citext unique not null check (handle ~ '^[a-z0-9_]{3,30}$'),
  bio text,
  niches text[] not null default '{}',
  country text,
  languages text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft','live','suspended')),
  created_at timestamptz not null default now()
);
alter table public.creator_profiles enable row level security;

create policy "live creator profiles are public, owners see own"
  on public.creator_profiles for select
  using (status = 'live' or (select auth.uid()) = user_id);
create policy "creators insert own"
  on public.creator_profiles for insert with check ((select auth.uid()) = user_id);
create policy "creators update own"
  on public.creator_profiles for update using ((select auth.uid()) = user_id);

create table public.brand_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  company text,
  website text,
  logo_url text,
  created_at timestamptz not null default now()
);
alter table public.brand_profiles enable row level security;

create policy "brand profiles readable by authenticated"
  on public.brand_profiles for select to authenticated using (true);
create policy "brands insert own"
  on public.brand_profiles for insert with check ((select auth.uid()) = user_id);
create policy "brands update own"
  on public.brand_profiles for update using ((select auth.uid()) = user_id);

-- auto-create profile row on signup; role comes from signup metadata
create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, role, display_name)
  values (
    new.id,
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'brand'),
    new.raw_user_meta_data->>'display_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
