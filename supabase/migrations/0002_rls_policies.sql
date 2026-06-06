-- RLS ポリシー
--
-- household_members の RLS が自テーブルを直接参照すると無限再帰になるため、
-- メンバー判定は SECURITY DEFINER 関数（RLS をバイパス）経由で行う。

-- 判定ヘルパー ----------------------------------------------------------------
create or replace function public.is_household_member(_household_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = _household_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_household_owner(_household_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = _household_id
      and user_id = auth.uid()
      and role = 'owner'
  );
$$;

-- RLS 有効化 ------------------------------------------------------------------
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;

-- households ------------------------------------------------------------------
create policy "households_select_member" on public.households
  for select using (public.is_household_member(id));

create policy "households_insert_self" on public.households
  for insert with check (created_by = auth.uid());

create policy "households_update_owner" on public.households
  for update using (public.is_household_owner(id)) with check (public.is_household_owner(id));

create policy "households_delete_owner" on public.households
  for delete using (public.is_household_owner(id));

-- household_members -----------------------------------------------------------
create policy "members_select_member" on public.household_members
  for select using (public.is_household_member(household_id));

-- メンバー追加（招待）は owner のみ。作成者の自動登録はトリガ（SECURITY DEFINER）が行う。
create policy "members_insert_owner" on public.household_members
  for insert with check (public.is_household_owner(household_id));

create policy "members_update_owner" on public.household_members
  for update using (public.is_household_owner(household_id)) with check (public.is_household_owner(household_id));

-- owner は誰でも削除可、メンバーは自分の脱退のみ可。
create policy "members_delete_owner_or_self" on public.household_members
  for delete using (
    public.is_household_owner(household_id) or user_id = auth.uid()
  );

-- categories ------------------------------------------------------------------
create policy "categories_select_member" on public.categories
  for select using (public.is_household_member(household_id));

create policy "categories_insert_member" on public.categories
  for insert with check (public.is_household_member(household_id));

create policy "categories_update_member" on public.categories
  for update using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));

create policy "categories_delete_member" on public.categories
  for delete using (public.is_household_member(household_id));

-- transactions ----------------------------------------------------------------
create policy "transactions_select_member" on public.transactions
  for select using (public.is_household_member(household_id));

create policy "transactions_insert_member" on public.transactions
  for insert with check (
    public.is_household_member(household_id) and created_by = auth.uid()
  );

-- 編集・削除は登録者本人のみ。
create policy "transactions_update_creator" on public.transactions
  for update using (created_by = auth.uid()) with check (created_by = auth.uid());

create policy "transactions_delete_creator" on public.transactions
  for delete using (created_by = auth.uid());
