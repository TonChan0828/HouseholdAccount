-- 家計簿グループ作成時の初期化トリガ
-- 1. 作成者を owner としてメンバー登録する（RLS のブートストラップ問題を回避）
-- 2. デフォルトカテゴリを付与する

create or replace function public.handle_new_household()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 作成者を owner として登録
  insert into public.household_members (household_id, user_id, role)
  values (new.id, new.created_by, 'owner');

  -- デフォルトカテゴリ（グループ共有）
  insert into public.categories (household_id, name, color, icon, type, is_default) values
    (new.id, '食費',       '#ef4444', 'utensils',       'expense', true),
    (new.id, '日用品',     '#f59e0b', 'shopping-cart',  'expense', true),
    (new.id, '住居費',     '#8b5cf6', 'home',           'expense', true),
    (new.id, '水道光熱費', '#3b82f6', 'zap',            'expense', true),
    (new.id, '交通費',     '#06b6d4', 'train',          'expense', true),
    (new.id, '通信費',     '#0ea5e9', 'smartphone',     'expense', true),
    (new.id, '娯楽費',     '#ec4899', 'gamepad-2',      'expense', true),
    (new.id, '医療費',     '#14b8a6', 'heart-pulse',    'expense', true),
    (new.id, 'その他支出', '#6b7280', 'ellipsis',       'expense', true),
    (new.id, '給与',       '#10b981', 'wallet',         'income',  true),
    (new.id, 'ボーナス',   '#22c55e', 'gift',           'income',  true),
    (new.id, 'その他収入', '#84cc16', 'plus',           'income',  true);

  return new;
end;
$$;

create trigger on_household_created
  after insert on public.households
  for each row execute function public.handle_new_household();
