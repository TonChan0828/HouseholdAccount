# 2026-06-12 — グループ選択画面の重複表示バグ修正

## やったこと

- セッションログ（2026-06-11）の未解決課題だった React duplicate key 警告の原因を調査・特定
  - `app/households/page.tsx` の memberships クエリが `household_members` を `user_id` で絞っておらず、RLS（`members_select_member`）が同居メンバー全員の行を返すため、N 人グループが N 枚重複表示されていた
  - DB 実データで確証: E2E ユーザーが2人メンバーのグループ「E2Eダッシュボード-1781044939636」に所属しており、これが警告の発生源（2人目は開発者アカウントが招待で手動参加したもの）
- 同根の潜在バグを2件発見し、まとめて修正
  - `setActiveHousehold`: `.maybeSingle()` が2人以上のグループで複数行エラーになり、**複数メンバーのグループへの切り替えが黙って失敗**していた
  - `lib/household.ts` のフォールバック: 他メンバーの `joined_at` で「最古のグループ」が決まり得た
- TDD: E2E（重複表示なし＋複数メンバーグループへの切り替え）を先に追加して Red を確認 → 3箇所に `.eq("user_id", user.id)` を追加して Green
- 検証: Vitest 115件・Playwright 13件（新規2件含む）・typecheck・lint すべてパス。E2E ブラウザログから duplicate key 警告が消えたことを確認

## 決めたこと・理由

- CLAUDE.md の「user_id 単体でのデータ取得禁止」は transactions/categories の household スコープの話であり、「自分の所属一覧・所属確認」は user_id で絞るのが正しい、と整理
- E2E は seed 済みの2人メンバーグループ（`e2e/constants.ts` の `MULTI_MEMBER_HOUSEHOLD`）を前提にした。E2E 内で2人目ユーザーを作るのはメール確認設定に依存するため見送り
- `households/page.tsx` に他ページと同じ `if (!user) redirect("/login")` ガードを追加（二重防御の既存パターンに合わせた）

## 次にやること

- PR #11 をマージ済み（完了）
- 次の候補（前セッションから継続）: Vercel デプロイ、表示名編集 UI、ダークモード

## 未解決の課題

- E2E がグループを毎回作成するため DB にデータが蓄積し続ける（クリーンアップ戦略は未定）
