-- アカウント削除（退会）
-- ログイン中ユーザーが自分の auth.users 行を削除する自己退会用 RPC。
--
-- auth.users の削除には昇格権限が必要だが、本アプリは anon キーのみで
-- service-role クライアントを持たない。そこで SECURITY DEFINER 関数として実装し、
-- 認証済みユーザーが auth.uid() の本人分のみを削除できるようにする。
--
-- 全 FK は auth.users(id) on delete cascade。素朴に削除すると本人が created_by の
-- グループ（households.created_by）も CASCADE で消え、他メンバーの共有データまで
-- 消滅する。これを避けるため、本人作成グループに他メンバーが残る場合は
-- 最古参メンバーへオーナーを委譲（role 昇格＋created_by 張り替え）してから削除する。
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  _uid uuid := auth.uid();
  _household record;
  _heir uuid;
begin
  if _uid is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  -- 本人が作成者のグループを走査し、他メンバーが残るものはオーナーを委譲する。
  for _household in
    select id from public.households where created_by = _uid
  loop
    -- 最古参の本人以外メンバーを後継オーナーに選ぶ。
    select user_id into _heir
    from public.household_members
    where household_id = _household.id and user_id <> _uid
    order by joined_at asc
    limit 1;

    -- 他メンバーがいなければ何もしない（後段の削除で CASCADE 消滅）。
    if _heir is not null then
      update public.household_members
      set role = 'owner'
      where household_id = _household.id and user_id = _heir;

      -- created_by を後継者へ張り替え、CASCADE 削除の対象から外す。
      update public.households
      set created_by = _heir
      where id = _household.id;
    end if;
  end loop;

  -- 本人を削除。household_members / 本人作成の transactions・invitations・profiles、
  -- および本人だけのグループは CASCADE で削除される。
  delete from auth.users where id = _uid;
end;
$$;

-- 退会はログイン済みユーザーのみが自分のために呼ぶ。anon からは実行不可。
-- Supabase の既定権限は public スキーマ関数に anon への EXECUTE を明示付与するため、
-- public からの revoke だけでは消えない。anon からも明示的に剥奪する（0007 と同方針）。
revoke execute on function public.delete_own_account() from public;
revoke execute on function public.delete_own_account() from anon;
grant execute on function public.delete_own_account() to authenticated;
