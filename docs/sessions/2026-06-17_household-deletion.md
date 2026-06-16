# 2026-06-17 — グループ削除機能

## やったこと

- 仕様書 `docs/specs/16_household_deletion.md` を作成。`CLAUDE.md` の一覧に追記、
  `15_member_management.md` の未解決課題（グループ削除は別途）を実装済みに更新
- 実装プラン（plan モード）: `/Users/show/.claude/plans/magical-exploring-octopus.md`
- ブランチ `feature/household-deletion`（`feature/member-management` の上に積む）
- **マイグレーション不要**: RLS `households_delete_owner`＋子テーブル全 CASCADE で対応済み
- `npx shadcn@latest add dialog` で `components/ui/dialog.tsx` を追加（base-nova / Base UI）
- Server Action `deleteHousehold`（`app/households/actions.ts`）: owner 確認 → `households` を
  delete（CASCADE）→ アクティブ Cookie クリア → `/households` へリダイレクト
- `DeleteHouseholdDialog`（`components/features/household/delete-household-dialog.tsx`）を TDD で追加（5 テスト）
  - 「グループを削除」→ モーダル確認 → 「削除する」。`memberCount>1` のとき他メンバーのデータ削除を警告
- `app/households/page.tsx` の owner カードに「危険な操作」セクションを追加
- `member-list.tsx`: 「委譲してから脱退できます」注記を **他メンバーがいる場合のみ** 表示に修正
  （単独 owner は削除導線を使うため）。E2E の該当アサーションも削除導線の確認に更新
- 検証: typecheck / lint / `test:run`（47 files・208 tests）PASS、`test:e2e household`（25 passed）
  - DB シミュレーション（ROLLBACK）: 複数メンバーのグループ削除で household_members / transactions /
    categories / household_invitations が CASCADE で 0 件になることを確認
  - ブラウザ実機（Playwright MCP）でモーダル→削除→一覧から消えるを確認（`deleteHousehold` 実行をログで確認）

## 決めたこと・理由

- **削除対象は owner の任意グループ**（ユーザー指定。単独メンバー限定にしない）。多人数グループの
  削除も可能で、他メンバーの共有データも消える。誤操作防止は**モーダル確認**で担保。
- **確認 UI は制御された（useState）モーダル**: 当初 Base UI の render-prop トリガーで実装したが、
  実ブラウザでモーダルが開かない事象があったため、`open` を `useState` で制御する方式に変更。
  ブラウザ・テスト双方で確実に開くことを Playwright MCP で確認。
- **マイグレーション不要**: RLS とスキーマの CASCADE が既に削除を許容しているため、Server Action と
  UI のみで完結。

## 次にやること

- `feature/household-deletion` を main へ統合（PR）。member-management とまとめて出すか要検討
- 蓄積する E2E 残骸は従来どおり SQL クリーンアップ（今回も実行）

## 未解決の課題

- ソフトデリート・ゴミ箱は設けない（即時・不可逆）
- 確認はモーダル単一ボタン（グループ名タイプ要求なし）
