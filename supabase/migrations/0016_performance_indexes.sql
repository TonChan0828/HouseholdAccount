-- パフォーマンス最適化: 高頻度ルックアップ向けの複合インデックスを追加する。
-- 既存は household_id / user_id が単独インデックスのみで、両方を等値で絞る
-- 所属判定（getActiveHouseholdId）やカテゴリ別集計が複合条件を活かせない。

-- household_members: .eq(household_id).eq(user_id) の所属判定が最頻。
create index if not exists household_members_household_user_idx
  on public.household_members (household_id, user_id);

-- transactions: household スコープ内のカテゴリ絞り込み・集計向け。
create index if not exists transactions_household_category_idx
  on public.transactions (household_id, category_id);
