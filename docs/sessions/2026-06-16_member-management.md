# 2026-06-16 — メンバー管理機能

## やったこと

- 仕様書 `docs/specs/15_member_management.md` を作成。`CLAUDE.md` の一覧に追記、`06_household.md` の
  「後続フェーズ」注記を 15 へのリンクに更新
- 実装プラン（plan モード）: `/Users/show/.claude/plans/magical-exploring-octopus.md`
- ブランチ `feature/member-management`
- マイグレーション `supabase/migrations/0013_transfer_ownership.sql` を追加し本番に適用
  - SECURITY DEFINER 関数 `public.transfer_ownership(_household_id, _new_owner)`
    （後継者を owner 昇格＋呼び出し元を member 降格＋`households.created_by` 張り替え）
  - owner 判定・後継者の所属確認・自分宛て拒否を関数内で検証。anon revoke / authenticated grant（0012 と同方針）
  - types を再生成し `types/database.ts` の Functions に手動マージ
- Server Action 3つを `app/households/actions.ts` に追加
  - `removeMember`（owner→他メンバー除外。自分自身はガード）／`leaveHousehold`（member 脱退・owner はエラーで委譲必須・
    アクティブ Cookie クリア→`/households`）／`transferOwnership`（RPC 呼び出し）
- `MemberList`（`components/features/household/member-list.tsx`）を TDD で追加（6 テスト）
  - 一覧描画（表示名・オーナー/あなたバッジ・参加日）、owner/member での委譲・除外・脱退の出し分け、
    破壊的操作は DOM 内の2段階確認（`confirm()` 不使用）
- `app/households/page.tsx` を再構成: 所属グループ全員のメンバー＋`profiles` 表示名を取得し、
  カードに「メンバー」セクションを全メンバー向けに常時表示（owner 設定はネスト）
- E2E（`e2e/household.spec.ts`）に非破壊シナリオを追加（単独オーナーのグループでメンバー一覧表示・
  脱退ボタン非表示・委譲案内）
- **複数人テストを可能化**: 2人目のテストユーザー `e2e-member@e2etest.dev`（pw `password123`,
  表示名「テストメンバー」）を auth.users＋auth.identities の SQL クローンで作成し、seed グループ
  MULTI_MEMBER_HOUSEHOLD に member 参加させた。ログイン検証済み（auth token エンドポイント）。
  `e2e/constants.ts` に `E2E_MEMBER_USER` を追加。オーナー視点で他メンバーに委譲・除外操作が
  出ることを確認する非破壊 E2E も追加
- E2E 残骸 80 件を SQL で削除（`/households` 肥大による既知の flake。メンバー取得クエリ追加で
  影響が増すため。削除後は household E2E 24 件すべて PASS・実行 40s に短縮）
- 検証: typecheck / lint / `test:run`（46 files・203 tests）すべて PASS、`test:e2e household`（23 passed）
  - DB 検証（共有 Supabase をトランザクション＋RAISE で ROLLBACK）:
    - `transfer_ownership`: b=owner / a=member / created_by=b を確認
    - ガード3種: member の委譲拒否・非メンバー宛て拒否・自分宛て拒否を確認
    - `members_delete_owner_or_self`: member の他人削除=0 / member 脱退=1 / owner 除外=1 を確認

## 決めたこと・理由

- **委譲は SECURITY DEFINER の RPC `transfer_ownership`**: 昇格・降格・created_by 張り替えの複数行更新を
  原子的に行い、降格途中の RLS WITH CHECK 評価順への依存を避ける（`delete_own_account` と同流儀）。
- **除外・脱退は既存 RLS で完結**: `members_delete_owner_or_self` が owner の他メンバー削除と本人脱退を
  1本でカバーするため、Server Action は薄いラッパに留め RPC は作らない。
- **owner 脱退は委譲必須**: owner には脱退ボタンを出さず、別メンバーへ委譲してから抜ける導線にする
  （オーナー不在グループの誤生成を防止）。単独 owner の脱退＝グループ削除は本スコープ外。
- **破壊的操作の確認は DOM 内2段階**: `confirm()` を避け、E2E で扱いやすくダイアログ依存も増やさない。
- **破壊的 E2E は見送り DB シミュレーションで代替**: E2E ユーザーが1名・共有 DB のため、実除外/委譲/脱退は
  ROLLBACK 検証で担保（`14_account_deletion.md` と同方針）。なお seed の MULTI_MEMBER_HOUSEHOLD は
  現状メンバー1名だった（破壊的多人数 E2E は不可）。

## 次にやること

- `feature/member-management` を main へ統合（PR）
- ブラウザでの手動確認（2アカウントで除外・委譲・脱退の往復）

## 未解決の課題

- 単独 owner の脱退（グループ削除）は別機能として未対応
- 複数 owner は許容しない（委譲＝単一オーナーのスワップ）
- E2E 残骸（`E2Eメンバー-<stamp>` 等）は既存のクリーンアップ対象パターンに合致（蓄積時に SQL で削除）
