-- SECURITY DEFINER ヘルパー関数を private スキーマへ移動する
-- （advisors WARN: authenticated_security_definer_function_executable 対応）。
--
-- is_household_member / is_household_owner / shares_household_with は RLS ポリシー内部から
-- のみ使うべき関数だが、public スキーマにあると PostgREST が /rest/v1/rpc/... として公開し、
-- 署名済みユーザーが直接呼べてしまう（所属・オーナー判定の真偽値が漏れる）。
--
-- 対処: PostgREST が公開しない private スキーマへ移し、RPC エンドポイントを消す。
-- RLS 評価では呼び出しユーザー（authenticated）の EXECUTE 権限が必要なため EXECUTE は維持する
-- （EXECUTE を剥奪すると RLS ポリシーが権限エラーで壊れるため、剥奪はしない）。
-- RLS 再帰回避のため SECURITY DEFINER は維持（呼び出しユーザーの RLS をバイパスして判定する）。

create schema if not exists private;
grant usage on schema private to authenticated, service_role;

-- ヘルパー関数を private に再作成（本体は現行と同一）。
create or replace function private.is_household_member(_household_id uuid)
  returns boolean
  language sql
  stable security definer
  set search_path to 'public'
as $$
  select exists (
    select 1 from public.household_members
    where household_id = _household_id and user_id = auth.uid()
  );
$$;

create or replace function private.is_household_owner(_household_id uuid)
  returns boolean
  language sql
  stable security definer
  set search_path to 'public'
as $$
  select exists (
    select 1 from public.household_members
    where household_id = _household_id and user_id = auth.uid() and role = 'owner'
  );
$$;

create or replace function private.shares_household_with(_user_id uuid)
  returns boolean
  language sql
  stable security definer
  set search_path to 'public'
as $$
  select exists (
    select 1
    from public.household_members mine
    join public.household_members theirs on mine.household_id = theirs.household_id
    where mine.user_id = auth.uid() and theirs.user_id = _user_id
  );
$$;

-- 実行権限は RLS 評価に必要な authenticated / service_role のみに付与（anon・PUBLIC からは外す）。
revoke execute on function private.is_household_member(uuid) from public;
revoke execute on function private.is_household_owner(uuid) from public;
revoke execute on function private.shares_household_with(uuid) from public;
grant execute on function private.is_household_member(uuid) to authenticated, service_role;
grant execute on function private.is_household_owner(uuid) to authenticated, service_role;
grant execute on function private.shares_household_with(uuid) to authenticated, service_role;

-- 全ポリシーを private.* 参照へ再作成（条件は現行と完全に等価。関数のスキーマのみ変更）。

-- categories
drop policy if exists categories_select_member on public.categories;
create policy categories_select_member on public.categories
  for select using (private.is_household_member(household_id));
drop policy if exists categories_insert_member on public.categories;
create policy categories_insert_member on public.categories
  for insert with check (private.is_household_member(household_id));
drop policy if exists categories_update_member on public.categories;
create policy categories_update_member on public.categories
  for update using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));
drop policy if exists categories_delete_member on public.categories;
create policy categories_delete_member on public.categories
  for delete using (private.is_household_member(household_id));

-- households
drop policy if exists households_select_member on public.households;
create policy households_select_member on public.households
  for select using (private.is_household_member(id));
drop policy if exists households_update_owner on public.households;
create policy households_update_owner on public.households
  for update using (private.is_household_owner(id))
  with check (private.is_household_owner(id));
drop policy if exists households_delete_owner on public.households;
create policy households_delete_owner on public.households
  for delete using (private.is_household_owner(id));

-- household_members
drop policy if exists members_select_member on public.household_members;
create policy members_select_member on public.household_members
  for select using (private.is_household_member(household_id));
drop policy if exists members_insert_owner on public.household_members;
create policy members_insert_owner on public.household_members
  for insert with check (private.is_household_owner(household_id));
drop policy if exists members_update_owner on public.household_members;
create policy members_update_owner on public.household_members
  for update using (private.is_household_owner(household_id))
  with check (private.is_household_owner(household_id));
drop policy if exists members_delete_owner_or_self on public.household_members;
create policy members_delete_owner_or_self on public.household_members
  for delete using (private.is_household_owner(household_id) or (user_id = (select auth.uid())));

-- household_invitations
drop policy if exists invitations_select_owner on public.household_invitations;
create policy invitations_select_owner on public.household_invitations
  for select using (private.is_household_owner(household_id));
drop policy if exists invitations_insert_owner on public.household_invitations;
create policy invitations_insert_owner on public.household_invitations
  for insert with check (private.is_household_owner(household_id) and (created_by = (select auth.uid())));
drop policy if exists invitations_update_owner on public.household_invitations;
create policy invitations_update_owner on public.household_invitations
  for update using (private.is_household_owner(household_id))
  with check (private.is_household_owner(household_id));
drop policy if exists invitations_delete_owner on public.household_invitations;
create policy invitations_delete_owner on public.household_invitations
  for delete using (private.is_household_owner(household_id));

-- transactions
drop policy if exists transactions_select_member on public.transactions;
create policy transactions_select_member on public.transactions
  for select using (private.is_household_member(household_id));
drop policy if exists transactions_insert_member on public.transactions;
create policy transactions_insert_member on public.transactions
  for insert with check (private.is_household_member(household_id) and (created_by = (select auth.uid())));

-- profiles
drop policy if exists profiles_select_shared on public.profiles;
create policy profiles_select_shared on public.profiles
  for select using ((id = (select auth.uid())) or private.shares_household_with(id));

-- 公開されていた public 版を削除（RPC エンドポイントが消える）。
drop function public.is_household_member(uuid);
drop function public.is_household_owner(uuid);
drop function public.shares_household_with(uuid);
