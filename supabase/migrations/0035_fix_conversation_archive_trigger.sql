-- Allow archive updates by any participant. The old trigger only permitted
-- the creator to update (for invite responses) and rejected everything else,
-- which blocked set_conversation_archived for brands.

create or replace function public.validate_conversation_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return new;
  end if;

  if new.brand_id <> old.brand_id
     or new.creator_id <> old.creator_id
     or new.invite_message <> old.invite_message
     or new.created_at <> old.created_at then
    raise exception 'Conversation identity cannot change';
  end if;

  -- Archive-only update: allow any participant
  if new.status = old.status
     and new.responded_at is not distinct from old.responded_at
     and (new.archived_by_brand_at is distinct from old.archived_by_brand_at
          or new.archived_by_creator_at is distinct from old.archived_by_creator_at) then
    return new;
  end if;

  -- Invite response: only the creator
  if v_uid = old.creator_id then
    if old.status <> 'invited' or new.status not in ('accepted', 'declined') then
      raise exception 'This invitation has already been answered';
    end if;
    new.responded_at := now();
  else
    raise exception 'Only the invited creator can respond';
  end if;

  return new;
end;
$$;
