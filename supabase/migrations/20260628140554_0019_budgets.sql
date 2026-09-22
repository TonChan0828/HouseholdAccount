-- 予算（Budgets）
--
-- 支出カテゴリごとに毎月固定の予算額を設定する。予算はグループ単位で共有され、
-- メンバー全員が設定・編集できる（created_by スコープは持たず categories と同方針）。
-- 当期（period_start_day 基準の会計期間）の実績支出と対比して進捗・超過を可視化する。

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  amount integer not null check (amount >= 1),
  created_at timestamptz not null default now(),
  -- 1 カテゴリにつき予算は 1 つ。upsert の競合キーに使う。
  unique (household_id, category_id)
);

create index budgets_household_idx on public.budgets (household_id);

-- RLS（categories の方針を踏襲：メンバーなら全操作可）------------------------
alter table public.budgets enable row level security;

create policy budgets_select_member on public.budgets
  for select using (private.is_household_member(household_id));

create policy budgets_insert_member on public.budgets
  for insert with check (private.is_household_member(household_id));

create policy budgets_update_member on public.budgets
  for update using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));

create policy budgets_delete_member on public.budgets
  for delete using (private.is_household_member(household_id));
