alter table public.conversations
  add column if not exists archived_by_brand_at timestamptz,
  add column if not exists archived_by_creator_at timestamptz;

create or replace function public.set_conversation_archived(
  p_conversation_id uuid,
  p_archived boolean
) returns public.conversations
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_conv public.conversations;
  v_ts timestamptz := case when p_archived then now() else null end;
begin
  select * into v_conv from public.conversations c where c.id = p_conversation_id;
  if not found then raise exception 'conversation not found'; end if;
  if v_conv.brand_id = v_uid then
    update public.conversations set archived_by_brand_at = v_ts where id = p_conversation_id returning * into v_conv;
  elsif v_conv.creator_id = v_uid then
    update public.conversations set archived_by_creator_at = v_ts where id = p_conversation_id returning * into v_conv;
  else
    raise exception 'not a participant';
  end if;
  return v_conv;
end;
$$;

grant execute on function public.set_conversation_archived(uuid, boolean) to authenticated;
