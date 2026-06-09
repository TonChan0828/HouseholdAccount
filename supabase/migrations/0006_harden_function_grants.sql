-- SECURITY DEFINER 関数の EXECUTE 権限を厳格化する。
--
-- Postgres は関数作成時に PUBLIC へ EXECUTE を付与する。0004 の
-- `revoke ... from anon` は PUBLIC 付与に隠れて無効だったため、
-- PUBLIC から剥奪したうえで authenticated にのみ付与し直す。
--
-- いずれの関数も内部で auth.uid() / RLS 判定に使うものであり、
-- 未ログイン（anon）から直接 RPC 実行させる必要はない。

-- 招待参加・プレビュー（ログイン必須）
revoke execute on function public.accept_invitation(text) from public;
revoke execute on function public.invitation_preview(text) from public;
grant execute on function public.accept_invitation(text) to authenticated;
grant execute on function public.invitation_preview(text) to authenticated;

-- RLS 判定ヘルパー（ポリシー評価で authenticated が使う）
revoke execute on function public.is_household_member(uuid) from public;
revoke execute on function public.is_household_owner(uuid) from public;
grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.is_household_owner(uuid) to authenticated;

-- グループ作成トリガ関数（トリガ専用。誰からも直接 RPC 実行させない）
revoke execute on function public.handle_new_household() from public;
