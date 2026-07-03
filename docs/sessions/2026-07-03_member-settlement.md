# 2026-07-03 — メンバー間精算（割り勘）機能の実装開始

## やったこと

- バックログからメンバー間精算を次機能として選定
- 要件のブレインストーミング（精算対象・按分・記録・UI 配置を確認）
- 仕様書 `docs/specs/37_member_settlement.md` を作成し CLAUDE.md の一覧へ追記

## 決めたこと・理由

- 精算対象は取引ごとの `is_shared` フラグ（個人支出が混ざっても精算が汚れない）
- 按分は現メンバー全員の均等割りのみ（YAGNI。比率設定は将来拡張）
- 期間（締め日）単位で「精算済みにする」を記録。`settlements` テーブルにスナップショット（jsonb）を保存し、後から取引が編集されても記録が壊れないようにする
- UI は新規ページ `/settlements`（/budgets と同じ Server Component + 純関数パターン）
- `recurring_transactions` にも `is_shared` を持たせ生成時に引き継ぐ（固定費こそ割り勘の主対象）
- グループ間反映（mirror）では `is_shared` を引き継がず false 固定
- 端数は最大剰余法で整数円に丸め、balance 合計 0 を保証。送金案は greedy で最大 N−1 件

## 次にやること

- 実装計画の作成 → TDD で実装（migration 0021 / lib/settlement.ts / フォーム / /settlements ページ）
- E2E: 精算対象を付けて記帳 → 送金案確認 → 精算済み → バッジ表示（user-stories.md 更新）

## 未解決の課題

- CSV 出力・インポート・FilterBar への `is_shared` 対応はスコープ外
- メンバー別比率での按分は将来拡張
