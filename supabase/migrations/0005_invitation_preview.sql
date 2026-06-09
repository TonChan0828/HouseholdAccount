-- 招待リンクの参加前プレビュー
-- 招待された本人は household_invitations / households を直接 SELECT できない
-- （RLS が owner / member 限定）。参加前にグループ名と有効性だけを返す
-- SECURITY DEFINER 関数を用意する。トークンは推測不能なため列挙リスクは低い。

create or replace function public.invitation_preview(_token text)
returns table (household_name text, status text)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  _inv public.household_invitations;
  _name text;
begin
  select * into _inv
  from public.household_invitations
  where token = _token;

  if not found then
    return query select null::text, 'not_found'::text;
    return;
  end if;

  select name into _name from public.households where id = _inv.household_id;

  if _inv.expires_at is not null and _inv.expires_at < now() then
    return query select _name, 'expired'::text;
    return;
  end if;

  if _inv.uses_count >= _inv.max_uses then
    return query select _name, 'exhausted'::text;
    return;
  end if;

  return query select _name, 'valid'::text;
end;
$$;

revoke execute on function public.invitation_preview(text) from anon;
