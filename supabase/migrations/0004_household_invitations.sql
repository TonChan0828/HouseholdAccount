-- 家計簿グループ 招待トークン
-- オープンリンク方式（owner が人数上限 max_uses を指定）。
-- 参加処理は accept_invitation 関数（SECURITY DEFINER）が原子的に行う。

-- household_invitations -------------------------------------------------------
create table public.household_invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  token text not null unique,
  created_by uuid not null references auth.users (id) on delete cascade,
  max_uses integer not null check (max_uses between 1 and 50),
  uses_count integer not null default 0 check (uses_count >= 0),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index household_invitations_household_id_idx on public.household_invitations (household_id);
create index household_invitations_token_idx on public.household_invitations (token);

alter table public.household_invitations enable row level security;

-- RLS: 招待の閲覧・発行・上限変更・失効はすべて owner のみ。
-- 招待された人は本テーブルへ直接アクセスせず、accept_invitation 経由で参加する。
create policy "invitations_select_owner" on public.household_invitations
  for select using (public.is_household_owner(household_id));

create policy "invitations_insert_owner" on public.household_invitations
  for insert with check (
    public.is_household_owner(household_id) and created_by = auth.uid()
  );

create policy "invitations_update_owner" on public.household_invitations
  for update using (public.is_household_owner(household_id))
  with check (public.is_household_owner(household_id));

create policy "invitations_delete_owner" on public.household_invitations
  for delete using (public.is_household_owner(household_id));

-- 参加処理 --------------------------------------------------------------------
-- household_members の insert ポリシーは owner 限定のため、招待された本人は
-- 自分を追加できない。この関数を SECURITY DEFINER（RLS バイパス）にして
-- auth.uid() で本人確認しつつ、上限・期限の判定を DB 側で原子的に行う。
create or replace function public.accept_invitation(_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _inv public.household_invitations;
begin
  if _uid is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  -- 上限超過の競合を防ぐため対象行をロックして取得
  select * into _inv
  from public.household_invitations
  where token = _token
  for update;

  if not found then
    raise exception 'invitation not found' using errcode = 'P0002';
  end if;

  if _inv.expires_at is not null and _inv.expires_at < now() then
    raise exception 'invitation expired' using errcode = 'P0001';
  end if;

  -- 既にメンバーなら冪等に成功（上限は消費しない）
  if exists (
    select 1 from public.household_members
    where household_id = _inv.household_id and user_id = _uid
  ) then
    return _inv.household_id;
  end if;

  if _inv.uses_count >= _inv.max_uses then
    raise exception 'invitation usage limit reached' using errcode = 'P0001';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (_inv.household_id, _uid, 'member');

  update public.household_invitations
  set uses_count = uses_count + 1
  where id = _inv.id;

  return _inv.household_id;
end;
$$;

-- 参加処理はログイン済みユーザーのみが自分のために呼ぶ。anon からは実行不可。
revoke execute on function public.accept_invitation(text) from anon;
