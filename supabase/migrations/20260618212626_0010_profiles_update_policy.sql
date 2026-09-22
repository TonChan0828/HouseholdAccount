-- profiles の UPDATE ポリシー（表示名編集 UI 用）
--
-- 0009 では書き込みポリシーを定義していなかった（編集 UI は将来対応）。
-- プロフィール設定画面の追加に伴い、本人の行のみ更新を許可する。

create policy "profiles_update_own" on public.profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());
