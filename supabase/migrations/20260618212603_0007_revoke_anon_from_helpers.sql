-- Supabase は関数作成時に anon / authenticated へ明示的に EXECUTE を付与する。
-- 0006 で PUBLIC からは剥奪したが、anon の明示付与が残っているため追加で剥奪する。
--
-- これらはログイン前提の機能であり、anon から直接 RPC 実行させる必要はない。

-- RLS 判定ヘルパー: authenticated（ポリシー評価で使用）のみ残す
revoke execute on function public.is_household_member(uuid) from anon;
revoke execute on function public.is_household_owner(uuid) from anon;

-- グループ作成トリガ関数: トリガからのみ起動。直接 RPC 実行は誰にも不要
-- （トリガ起動は呼び出しユーザーの EXECUTE 権限を必要としない）。
revoke execute on function public.handle_new_household() from anon;
revoke execute on function public.handle_new_household() from authenticated;
