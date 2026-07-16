-- rls_auto_enable はテーブル作成時に RLS を自動有効化するイベントトリガー関数。
-- イベントトリガーは呼び出しユーザーの EXECUTE 権限を必要とせずオーナー権限で動くため、
-- anon / authenticated / PUBLIC から直接 RPC 実行できる必要はない（advisors WARN 対応）。
-- ローカルのクリーンDBには対象イベントトリガーが存在しないため、存在時だけ剥奪する。
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public;
    revoke execute on function public.rls_auto_enable() from anon;
    revoke execute on function public.rls_auto_enable() from authenticated;
  end if;
end;
$$;
