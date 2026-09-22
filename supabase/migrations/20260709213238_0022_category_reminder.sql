-- カテゴリ別登録漏れリマインダー（spec 38）
--
-- カテゴリごとに「月末3日前までにこのカテゴリの登録が無ければ通知する」を
-- 有効化できるようにする。既定は無効（false）。

alter table public.categories
  add column reminder_enabled boolean not null default false;
