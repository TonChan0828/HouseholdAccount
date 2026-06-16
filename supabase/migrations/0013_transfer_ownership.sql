-- オーナー権限の委譲
-- グループのオーナーが、同じグループの別メンバーへオーナーを譲るための RPC。
--
-- 委譲は (1) 後継メンバーを owner に昇格 (2) 呼び出し元を member に降格
-- (3) households.created_by を後継者へ張り替え、の3つを原子的に行う必要がある。
-- household_members の RLS UPDATE は owner のみ許可だが、降格で自分が owner で
-- なくなる過程の WITH CHECK 評価順に依存したくないため、delete_own_account()（0012）と
-- 同じく SECURITY DEFINER 関数として実装し、呼び出し元の owner 判定を関数内で行う。
create or replace function public.transfer_ownership(
  _household_id uuid,
  _new_owner uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
begin
  if _uid is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if _new_owner = _uid then
    raise exception 'cannot transfer ownership to yourself';
  end if;

  -- 呼び出し元が当該グループの owner であること。
  if not exists (
    select 1 from public.household_members
    where household_id = _household_id and user_id = _uid and role = 'owner'
  ) then
    raise exception 'only the owner can transfer ownership';
  end if;

  -- 後継者が同じグループのメンバーであること。
  if not exists (
    select 1 from public.household_members
    where household_id = _household_id and user_id = _new_owner
  ) then
    raise exception 'new owner is not a member of this household';
  end if;

  -- 後継者を owner に昇格。
  update public.household_members
  set role = 'owner'
  where household_id = _household_id and user_id = _new_owner;

  -- 呼び出し元を member に降格（単一オーナーを維持）。
  update public.household_members
  set role = 'member'
  where household_id = _household_id and user_id = _uid;

  -- created_by を後継者へ張り替え（delete_own_account の委譲ロジックと整合）。
  update public.households
  set created_by = _new_owner
  where id = _household_id;
end;
$$;

-- 委譲はログイン済みメンバーのみが呼ぶ。anon からは実行不可（0007 / 0012 と同方針）。
revoke execute on function public.transfer_ownership(uuid, uuid) from public;
revoke execute on function public.transfer_ownership(uuid, uuid) from anon;
grant execute on function public.transfer_ownership(uuid, uuid) to authenticated;
