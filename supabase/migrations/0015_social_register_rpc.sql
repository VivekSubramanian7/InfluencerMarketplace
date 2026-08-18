-- Creators self-register a social handle on connected_accounts, which is
-- otherwise service-role-only (0002 revoked insert/update from authenticated).
-- Stats stay null until a service-role sync fills them; token_ref is never
-- touched here (reserved for the future OAuth path via Vault).
create function public.register_social_account(
  p_platform public.platform,
  p_handle text
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_handle text := lower(trim(both '@' from trim(coalesce(p_handle, ''))));
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;
  if not exists (select 1 from public.creator_profiles cp where cp.user_id = v_uid) then
    raise exception 'Create your creator profile first';
  end if;
  -- permissive superset of YouTube/TikTok/Instagram handle rules;
  -- the app layer validates per-platform before calling
  if v_handle !~ '^[a-z0-9][a-z0-9._-]{1,29}$' then
    raise exception 'Invalid handle';
  end if;

  insert into public.connected_accounts as ca (creator_id, platform, platform_handle)
  values (v_uid, p_platform, v_handle)
  on conflict (creator_id, platform) do update set
    platform_handle = excluded.platform_handle,
    -- same handle re-registered: keep synced stats (idempotent);
    -- changed handle: reset to a clean pending row
    follower_count = case when ca.platform_handle = excluded.platform_handle
                          then ca.follower_count else null end,
    avg_views = case when ca.platform_handle = excluded.platform_handle
                     then ca.avg_views else null end,
    engagement_rate = case when ca.platform_handle = excluded.platform_handle
                           then ca.engagement_rate else null end,
    last_synced_at = case when ca.platform_handle = excluded.platform_handle
                          then ca.last_synced_at else null end,
    verification_status = case when ca.platform_handle = excluded.platform_handle
                               then ca.verification_status else 'pending' end;
    -- token_ref deliberately absent from the update list
end;
$$;

revoke execute on function public.register_social_account(public.platform, text)
  from public, anon;
grant execute on function public.register_social_account(public.platform, text)
  to authenticated, service_role;
