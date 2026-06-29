-- 貯金目標（Savings Goals）
--
-- 家計簿グループに 1 つの貯金目標を設定する（household_id を UNIQUE）。
-- 進捗（貯金額）は start_date 以降・今日までの世帯全体の (収入 − 支出) から
-- アプリ側で算出する。専用の積立記録は持たず transactions から導出する。
-- 目標はグループ単位で共有され、メンバー全員が設定・編集できる
-- （created_by スコープは持たず budgets / categories と同方針）。

create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  target_amount integer not null check (target_amount >= 1),
  start_date date not null,
  target_date date,
  created_at timestamptz not null default now(),
  -- グループに 1 つ。upsert の競合キーに使う。
  unique (household_id)
);

create index savings_goals_household_idx on public.savings_goals (household_id);

-- RLS（budgets の方針を踏襲：メンバーなら全操作可）------------------------
alter table public.savings_goals enable row level security;

create policy savings_goals_select_member on public.savings_goals
  for select using (private.is_household_member(household_id));

create policy savings_goals_insert_member on public.savings_goals
  for insert with check (private.is_household_member(household_id));

create policy savings_goals_update_member on public.savings_goals
  for update using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));

create policy savings_goals_delete_member on public.savings_goals
  for delete using (private.is_household_member(household_id));
