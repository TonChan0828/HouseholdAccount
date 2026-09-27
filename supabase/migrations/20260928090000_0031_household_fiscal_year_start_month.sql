-- 年度分析の基準となる年度開始月を世帯ごとに保持する。
-- 既存の締め日・期間と同じく全メンバーに適用され、既存データは暦年（1月始まり）を維持する。
alter table public.households
  add column fiscal_year_start_month integer not null default 1
    check (fiscal_year_start_month between 1 and 12);
