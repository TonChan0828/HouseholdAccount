-- 家計簿の「月の区切り」開始日（締め日モデル）。
-- 期間は [開始日, 翌月の開始日) の半開区間。
-- 31/30 始まりは短い月で消失するため 1〜28 に制限。デフォルトは 1（暦月）。

alter table public.households
  add column period_start_day integer not null default 1
    check (period_start_day between 1 and 28);
