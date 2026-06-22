-- グループ毎の表示名（ニックネーム）
-- ユーザーがグループ（家計簿）ごとに別の表示名を設定できるようにする。
-- 未設定（NULL）のグループでは profiles.display_name（グローバル名）にフォールバックする。

-- 1) household_members に nullable な display_name を追加（NULL = フォールバック）。
alter table public.household_members
  add column if not exists display_name text;

-- 2) 自分自身のグループ毎の表示名を更新する RPC。
-- 既存 RLS の members_update_owner は owner のみ UPDATE を許可するため、member が
-- 自分の行を更新できない。RLS を緩めると列を限定できず role 自己昇格リスクがあるため、
-- display_name だけを更新する SECURITY DEFINER 関数として実装し、呼び出し元自身の
-- 行のみ更新する（delete_own_account(0012) / transfer_ownership(0013) と同じ作法）。
-- 空文字・空白のみは NULL に正規化＝ニックネーム解除。
create or replace function public.set_member_display_name(
  _household_id uuid,
  _display_name text
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

  update public.household_members
  set display_name = nullif(btrim(_display_name), '')
  where household_id = _household_id and user_id = _uid;

  if not found then
    raise exception 'not a member of this household';
  end if;
end;
$$;

-- ログイン済みメンバーのみが呼ぶ。anon からは実行不可（0007 / 0012 / 0013 と同方針）。
revoke execute on function public.set_member_display_name(uuid, text) from public;
revoke execute on function public.set_member_display_name(uuid, text) from anon;
grant execute on function public.set_member_display_name(uuid, text) to authenticated;
