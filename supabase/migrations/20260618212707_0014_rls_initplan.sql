-- RLS パフォーマンス最適化（advisors WARN: auth_rls_initplan 対応）。
-- ポリシー内の auth.uid() は行ごとに再評価されるため、(select auth.uid()) に置き換えて
-- 1クエリ1回の評価にする。条件ロジックは現行と完全に等価（挙動は変わらない）。
-- ロール指定は現行どおり PUBLIC（auth.uid() が null の anon は従来どおり弾かれる）。

-- households: 作成者本人のみ INSERT
drop policy if exists households_insert_self on public.households;
create policy households_insert_self on public.households
  for insert
  with check (created_by = (select auth.uid()));

-- household_members: owner か本人のみ DELETE（脱退・除外）
drop policy if exists members_delete_owner_or_self on public.household_members;
create policy members_delete_owner_or_self on public.household_members
  for delete
  using (is_household_owner(household_id) or (user_id = (select auth.uid())));

-- transactions: メンバーが自分を登録者として INSERT
drop policy if exists transactions_insert_member on public.transactions;
create policy transactions_insert_member on public.transactions
  for insert
  with check (is_household_member(household_id) and (created_by = (select auth.uid())));

-- transactions: 登録者本人のみ UPDATE
drop policy if exists transactions_update_creator on public.transactions;
create policy transactions_update_creator on public.transactions
  for update
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));

-- transactions: 登録者本人のみ DELETE
drop policy if exists transactions_delete_creator on public.transactions;
create policy transactions_delete_creator on public.transactions
  for delete
  using (created_by = (select auth.uid()));

-- household_invitations: owner のみ INSERT
drop policy if exists invitations_insert_owner on public.household_invitations;
create policy invitations_insert_owner on public.household_invitations
  for insert
  with check (is_household_owner(household_id) and (created_by = (select auth.uid())));

-- profiles: 本人または同居メンバーの行のみ SELECT
drop policy if exists profiles_select_shared on public.profiles;
create policy profiles_select_shared on public.profiles
  for select
  using ((id = (select auth.uid())) or shares_household_with(id));

-- profiles: 本人のみ UPDATE
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
