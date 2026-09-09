-- Break infinite RLS recursion: campaigns policy reads campaign_invites,
-- whose policy read campaigns. Fix by making the invite policy use a
-- security-definer helper that bypasses RLS on campaigns.

create or replace function public.campaign_brand_id(p_campaign_id uuid)
returns uuid
language sql security definer set search_path = ''
stable
as $$
  select brand_id from public.campaigns where id = p_campaign_id;
$$;

drop policy if exists "brand sees own campaign invites" on public.campaign_invites;
create policy "brand sees own campaign invites" on public.campaign_invites
  for select to authenticated using (
    creator_id = (select auth.uid())
    or public.campaign_brand_id(campaign_id) = (select auth.uid())
  );
