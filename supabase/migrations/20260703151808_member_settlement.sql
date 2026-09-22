-- メンバー間精算（spec 37）
--
-- 支出に「精算対象（割り勘）」フラグを追加し、当期の対象支出を全メンバーで
-- 均等割りした結果を settlements に期間単位で記録する。
-- snapshot には精算時点の計算結果（SettlementResult + 表示名）を保存し、
-- 後から取引が編集されても記録が壊れないようにする。

alter table public.transactions
  add column is_shared boolean not null default false;

alter table public.recurring_transactions
  add column is_shared boolean not null default false;

-- 定期収支の自動生成に is_shared を引き継ぐ（0018 の定義を置き換え。
-- create or replace は既存の GRANT/REVOKE を維持するため権限の再設定は不要）。
create or replace function public.generate_due_recurring(_household_id uuid)
  returns integer
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_start_day   integer;
  v_month_start date;
  v_period_start date;
  v_inserted    integer;
begin
  -- 呼び出し者が当該グループのメンバーであることを確認する。
  if not private.is_household_member(_household_id) then
    return 0;
  end if;

  select period_start_day into v_start_day
  from public.households
  where id = _household_id;

  if v_start_day is null then
    return 0;
  end if;

  -- 当期の開始日を算出する（period_start_day は 1〜28 なので月末調整は不要）。
  v_month_start := date_trunc('month', current_date)::date;
  v_period_start := v_month_start + (v_start_day - 1);
  if current_date < v_period_start then
    v_period_start := (v_month_start - interval '1 month')::date + (v_start_day - 1);
  end if;

  with inserted as (
    insert into public.transactions
      (household_id, created_by, type, amount, category_id, date, memo, recurring_id, is_shared)
    select
      r.household_id, r.created_by, r.type, r.amount, r.category_id,
      v_period_start, r.memo, r.id, r.is_shared
    from public.recurring_transactions r
    where r.household_id = _household_id
      and r.is_active
    on conflict (recurring_id, date) where recurring_id is not null do nothing
    returning 1
  )
  select count(*) into v_inserted from inserted;

  return v_inserted;
end;
$$;

-- 精算記録テーブル ------------------------------------------------------------
create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  period_start date not null,
  settled_by uuid not null references auth.users (id) on delete cascade,
  settled_at timestamptz not null default now(),
  snapshot jsonb not null,
  -- 同一期間の二重精算を DB レベルで防止する。
  unique (household_id, period_start)
);

create index settlements_household_idx on public.settlements (household_id);

-- RLS ------------------------------------------------------------------------
alter table public.settlements enable row level security;

create policy settlements_select_member on public.settlements
  for select using (private.is_household_member(household_id));

-- 精算の実行はメンバーなら誰でも可。ただし settled_by は本人に限定する。
create policy settlements_insert_member on public.settlements
  for insert with check (
    private.is_household_member(household_id)
    and (settled_by = (select auth.uid()))
  );

-- 取り消しは実行者本人のみ。
create policy settlements_delete_creator on public.settlements
  for delete using (
    private.is_household_member(household_id)
    and (settled_by = (select auth.uid()))
  );
-- UPDATE ポリシーは定義しない（更新は行わない）。
