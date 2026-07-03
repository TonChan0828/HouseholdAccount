# 2026-07-03 — メンバー間精算（割り勘）機能の実装

## やったこと

- バックログからメンバー間精算を次機能として選定
- 要件のブレインストーミング（精算対象・按分・記録・UI 配置を確認）
- 仕様書 `docs/specs/37_member_settlement.md` を作成し CLAUDE.md の一覧へ追記
- 実装計画 `docs/superpowers/plans/2026-07-04-member-settlement.md` を作成
- `feat/member-settlement` ブランチで TDD 実装（2026-07-04）:
  - migration 0021（`transactions.is_shared`・`recurring_transactions.is_shared`・`settlements` テーブル + RLS・`generate_due_recurring` 置き換え）を作成し Supabase へ適用
  - `lib/settlement.ts`（均等割り・最大剰余法・greedy 送金案・差異判定）
  - バリデーション・収支/定期収支の CRUD・一覧バッジ・記帳フォームのチェックボックス
  - `createSettlement` / `deleteSettlement` Server Action（二重精算は unique 制約 23505 で検出）
  - `/settlements` ページ（MonthNav・精算済みスナップショット表示・差異警告・取り消し）とナビ「精算」
  - E2E `e2e/settlements.spec.ts`（2人参加→均等割り→確定→差異警告→取り消し）と `docs/user-stories.md` 37 行目を追加

## 決めたこと・理由

- 精算対象は取引ごとの `is_shared` フラグ（個人支出が混ざっても精算が汚れない）
- 按分は現メンバー全員の均等割りのみ（YAGNI。比率設定は将来拡張）
- 期間（締め日）単位で「精算済みにする」を記録。`settlements` テーブルにスナップショット（jsonb）を保存し、後から取引が編集されても記録が壊れないようにする
- UI は新規ページ `/settlements`（/budgets と同じ Server Component + 純関数パターン）
- `recurring_transactions` にも `is_shared` を持たせ生成時に引き継ぐ（固定費こそ割り勘の主対象）
- グループ間反映（mirror）では `is_shared` を引き継がず false 固定
- 端数は最大剰余法で整数円に丸め、balance 合計 0 を保証。送金案は greedy で最大 N−1 件
- Dialog は既存パターン（controlled open + 外部ボタン）に従う。`DialogTrigger asChild` は本プロジェクトの Base UI 版では使えない（render prop 方式）
- デモモードは `TransactionForm` を共用するためチェックボックスは表示されるが、デモストアは `is_shared` を常に false で登録（デモ対応はスコープ外）

## 次にやること

- E2E 全件（`--workers=1`）の通過確認 → PR 作成・マージ
- 将来拡張: メンバー別比率按分・CSV/インポート/FilterBar への `is_shared` 対応

## 未解決の課題

- CSV 出力・インポート・FilterBar への `is_shared` 対応はスコープ外
- メンバー別比率での按分は将来拡張
- 精算済み期間の取引編集はブロックせず差異警告のみ（仕様どおり）
