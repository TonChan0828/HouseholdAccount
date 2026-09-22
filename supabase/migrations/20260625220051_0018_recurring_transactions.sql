-- 定期収支（Recurring Transactions）
--
-- 固定費・固定収入を「定期項目」として登録し、各期間の開始日（period_start_day）に
-- 収支を自動生成する。生成はメンバーがアプリを開いたタイミングで RPC を冪等に呼んで行う。
--
-- RLS の壁: transactions の INSERT ポリシーは created_by = auth.uid() を要求するため、
-- 閲覧中メンバーが別メンバー名義の収支を生成できない。これを解決するため、生成は
-- SECURITY DEFINER 関数 generate_due_recurring 経由で行う（既存の transfer_ownership 等と同方針）。

-- 定期項目テーブル ------------------------------------------------------------
create table public.recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  type public.transaction_type not null,
  amount integer not null check (amount >= 1),
  category_id uuid references public.categories (id) on delete set null,
  memo text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index recurring_transactions_household_idx
  on public.recurring_transactions (household_id);

-- transactions に生成元リンクを追加 ------------------------------------------
-- ルール削除時は set null とし、過去に生成された収支は履歴として残す。
alter table public.transactions
  add column recurring_id uuid references public.recurring_transactions (id) on delete set null;

-- 同一ルール × 同一期間開始日の二重生成を DB レベルで防止する（複数メンバー同時アクセスでも安全）。
create unique index transactions_recurring_period_uidx
  on public.transactions (recurring_id, date)
  where recurring_id is not null;

-- RLS（transactions の方針を踏襲）--------------------------------------------
alter table public.recurring_transactions enable row level security;

create policy recurring_select_member on public.recurring_transactions
  for select using (private.is_household_member(household_id));

create policy recurring_insert_member on public.recurring_transactions
  for insert with check (
    private.is_household_member(household_id) and (created_by = (select auth.uid()))
  );

-- 編集・削除は登録者本人のみ。
create policy recurring_update_creator on public.recurring_transactions
  for update using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));

create policy recurring_delete_creator on public.recurring_transactions
  for delete using (created_by = (select auth.uid()));

-- 当期分の定期項目を生成する SECURITY DEFINER 関数 ----------------------------
-- 冪等（ON CONFLICT DO NOTHING）。生成した件数を返す。
-- 当期の開始日は period_start_day から関数内で算出する（任意日付を引数で受け取らないことで、
-- メンバーが別期間の生成を強制できないようにする）。
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
      (household_id, created_by, type, amount, category_id, date, memo, recurring_id)
    select
      r.household_id, r.created_by, r.type, r.amount, r.category_id,
      v_period_start, r.memo, r.id
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

-- 既定権限により anon にも EXECUTE が付くため、明示的に剥奪する（revoke from public では
-- 個別付与された anon の権限は消えない）。サインインユーザーのみ呼べるようにする。
revoke execute on function public.generate_due_recurring(uuid) from public;
revoke execute on function public.generate_due_recurring(uuid) from anon;
grant execute on function public.generate_due_recurring(uuid) to authenticated, service_role;
