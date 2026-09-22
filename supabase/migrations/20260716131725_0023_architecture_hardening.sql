-- アーキテクチャ・データ境界強化（spec 39）

-- 異なる household のカテゴリ参照を正規化する。
update public.transactions t
set category_id = null
where category_id is not null
  and not exists (
    select 1 from public.categories c
    where c.id = t.category_id and c.household_id = t.household_id
  );

update public.recurring_transactions r
set category_id = null
where category_id is not null
  and not exists (
    select 1 from public.categories c
    where c.id = r.category_id and c.household_id = r.household_id
  );

delete from public.budgets b
where not exists (
  select 1 from public.categories c
  where c.id = b.category_id and c.household_id = b.household_id
);

-- 複合外部キーにより category と参照元の household 一致を DB で保証する。
alter table public.categories
  add constraint categories_household_id_id_key unique (household_id, id);

-- 既存の category_id 単独 FK は複合 FK と関係が重複して PostgREST の埋め込みが
-- 曖昧になるため置き換える。削除時の既存挙動は複合 FK 側で維持する。
alter table public.transactions drop constraint transactions_category_id_fkey;
alter table public.recurring_transactions drop constraint recurring_transactions_category_id_fkey;
alter table public.budgets drop constraint budgets_category_id_fkey;

alter table public.transactions
  add constraint transactions_household_category_fkey
  foreign key (household_id, category_id)
  references public.categories (household_id, id)
  on delete set null (category_id);

alter table public.recurring_transactions
  add constraint recurring_transactions_household_category_fkey
  foreign key (household_id, category_id)
  references public.categories (household_id, id)
  on delete set null (category_id);

alter table public.budgets
  add constraint budgets_household_category_fkey
  foreign key (household_id, category_id)
  references public.categories (household_id, id)
  on delete cascade;

-- アプリの入力検証と同じ重要な整合性を DB にも持たせる。
alter table public.transactions drop constraint if exists transactions_amount_check;
alter table public.transactions
  add constraint transactions_amount_check check (amount >= 1),
  add constraint transactions_memo_length_check
    check (memo is null or char_length(memo) <= 200);

alter table public.recurring_transactions
  add constraint recurring_transactions_memo_length_check
    check (memo is null or char_length(memo) <= 200);

alter table public.savings_goals
  add constraint savings_goals_name_length_check
    check (char_length(btrim(name)) between 1 and 100),
  add constraint savings_goals_target_date_check
    check (target_date is null or target_date > start_date);

-- UPDATE/DELETE は登録者本人であることに加えて、現在も対象 household の
-- メンバーであることを要求する。household_id の移動も WITH CHECK で防ぐ。
drop policy if exists transactions_update_creator on public.transactions;
create policy transactions_update_creator on public.transactions
  for update
  using (
    created_by = (select auth.uid())
    and private.is_household_member(household_id)
  )
  with check (
    created_by = (select auth.uid())
    and private.is_household_member(household_id)
  );

drop policy if exists transactions_delete_creator on public.transactions;
create policy transactions_delete_creator on public.transactions
  for delete
  using (
    created_by = (select auth.uid())
    and private.is_household_member(household_id)
  );

drop policy if exists recurring_update_creator on public.recurring_transactions;
create policy recurring_update_creator on public.recurring_transactions
  for update
  using (
    created_by = (select auth.uid())
    and private.is_household_member(household_id)
  )
  with check (
    created_by = (select auth.uid())
    and private.is_household_member(household_id)
  );

drop policy if exists recurring_delete_creator on public.recurring_transactions;
create policy recurring_delete_creator on public.recurring_transactions
  for delete
  using (
    created_by = (select auth.uid())
    and private.is_household_member(household_id)
  );

-- メンバーが脱退・除外された時点で、その人が作成した定期収支を停止する。
create or replace function private.deactivate_departed_member_recurring()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $$
begin
  update public.recurring_transactions
  set is_active = false
  where household_id = old.household_id
    and created_by = old.user_id
    and is_active;
  return old;
end;
$$;

revoke execute on function private.deactivate_departed_member_recurring() from public;
revoke execute on function private.deactivate_departed_member_recurring() from anon;
revoke execute on function private.deactivate_departed_member_recurring() from authenticated;

create trigger household_member_deactivate_recurring
  after delete on public.household_members
  for each row execute function private.deactivate_departed_member_recurring();

-- Vercel Cron から service role で呼び出し、指定日の全 household の当期分を生成する。
create or replace function public.generate_all_due_recurring(_as_of_date date)
  returns integer
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_inserted integer;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  with due as (
    select
      r.id as recurring_id,
      r.household_id,
      r.created_by,
      r.type,
      r.amount,
      r.category_id,
      r.memo,
      r.is_shared,
      case
        when _as_of_date >= date_trunc('month', _as_of_date)::date + (h.period_start_day - 1)
          then date_trunc('month', _as_of_date)::date + (h.period_start_day - 1)
        else (date_trunc('month', _as_of_date) - interval '1 month')::date
          + (h.period_start_day - 1)
      end as period_start
    from public.recurring_transactions r
    join public.households h on h.id = r.household_id
    join public.household_members hm
      on hm.household_id = r.household_id and hm.user_id = r.created_by
    where r.is_active
  ), inserted as (
    insert into public.transactions
      (household_id, created_by, type, amount, category_id, date, memo, recurring_id, is_shared)
    select
      household_id, created_by, type, amount, category_id, period_start,
      memo, recurring_id, is_shared
    from due
    on conflict (recurring_id, date) where recurring_id is not null do nothing
    returning 1
  )
  select count(*) into v_inserted from inserted;

  return v_inserted;
end;
$$;

revoke execute on function public.generate_all_due_recurring(date) from public;
revoke execute on function public.generate_all_due_recurring(date) from anon;
revoke execute on function public.generate_all_due_recurring(date) from authenticated;
grant execute on function public.generate_all_due_recurring(date) to service_role;
