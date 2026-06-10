-- メンバー表示名を保持する profiles テーブル
--
-- auth.users はクライアントから参照できないため、表示名を public.profiles に持つ。
-- 登録は auth.users への INSERT トリガで自動化し、初期値はメールの @ より前とする。

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

-- 判定ヘルパー ----------------------------------------------------------------
-- 対象ユーザーと自分が同じ household に所属しているか。
-- household_members の RLS を介さず判定するため SECURITY DEFINER にする。
create or replace function public.shares_household_with(_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.household_members mine
    join public.household_members theirs
      on mine.household_id = theirs.household_id
    where mine.user_id = auth.uid()
      and theirs.user_id = _user_id
  );
$$;

-- RLS ------------------------------------------------------------------------
alter table public.profiles enable row level security;

-- 自分自身、または同じ household のメンバーのみ参照可能。
-- 書き込みポリシーは定義しない（登録はトリガ経由のみ。編集 UI は将来対応）。
create policy "profiles_select_shared" on public.profiles
  for select using (id = auth.uid() or public.shares_household_with(id));

-- 新規ユーザー登録トリガ --------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(split_part(new.email, '@', 1), ''), 'user'));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 既存ユーザーのバックフィル -----------------------------------------------------
insert into public.profiles (id, display_name)
select id, coalesce(nullif(split_part(email, '@', 1), ''), 'user')
from auth.users
on conflict (id) do nothing;

-- 権限の硬化（0006 / 0007 と同方針） --------------------------------------------
revoke execute on function public.shares_household_with(uuid) from public;
revoke execute on function public.shares_household_with(uuid) from anon;

revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;
