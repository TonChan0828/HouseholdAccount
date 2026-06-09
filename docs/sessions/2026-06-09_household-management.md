# 2026-06-09 — 家計簿グループ 作成・招待・切り替え UI

## やったこと

- マイグレーション 0001〜0003 を Supabase（project: kykodjgtgrftczofridh）へ適用、型を再生成（前段）
- `.env.local` を作成し dev サーバーで接続確認（前段）
- 仕様書 06_household.md を本フェーズ仕様（作成/切替/招待トークン）へ更新
- migration 0004（household_invitations + accept_invitation）・0005（invitation_preview）を作成・適用、型再生成
- バリデーション（createHouseholdSchema / invitationLimitSchema）を TDD で実装（10件）
- Server Actions: createHousehold / setActiveHousehold / createInvitation / updateInvitation / revokeInvitation / acceptInvitation
- UI: /households（一覧・作成・切替・owner招待発行/上限変更/失効）、/invite/[token]（参加）。コンポーネントテスト3件
- E2E: 確認済みテストユーザー（e2e@e2etest.dev）を seed し、storageState 方式でログイン。作成→切替、招待発行→参加プレビューを検証（6 passed）
- 検証: typecheck / lint / vitest（21 passed）/ playwright（6 passed）すべて green

## 決めたこと・理由

- 招待は**招待トークン方式（オープンリンク）**。service_role 不要・クライアント+RLS で完結し、ポートフォリオで実演しやすい
- トークンに**人数上限（max_uses）**を持たせる。理由: 想定外の参加を防ぐため
- max_uses は**発行後も owner が変更可能**。減らしても既存メンバーは外れず「以降の新規参加」のみ抑止
- 有効期限（デフォルト7日）＋ owner による失効（revoke）を備える
- 参加処理は **`accept_invitation(_token)` SECURITY DEFINER 関数**で原子的に実施（household_members の insert が owner 限定のため、RLS をバイパスしつつ auth.uid() で本人確認、上限判定もDB側で原子的に）

## 次にやること

- メンバー一覧・脱退・削除 UI（後続フェーズ 07 member_activity と合わせて検討）
- 収支記録（02_transactions）の実装着手
- 招待された別ユーザーが実際に参加する multi-user E2E（現状はオーナー自身での参加プレビューまで）

## 決めたこと・理由（追記）

- household 作成は `INSERT ... RETURNING`（.select()）を使わず **ID をアプリ側で発番**。
  AFTER INSERT トリガがメンバー登録する前に RETURNING の RLS SELECT が走り 42501 で弾かれるため
- E2E はメール確認が有効でUI登録ではセッションが張れないため、**確認済みユーザーをDBに seed**し
  storageState 方式でログイン状態を再利用（`e2e/constants.ts` に資格情報、`e2e/.auth/` は gitignore）

## 未解決の課題

- メール確認有効のため、新規登録のハッピーパスは E2E 化できていない（seed ユーザーで代替）
- get_advisors(security) の SECURITY DEFINER 関数 WARN（accept_invitation / invitation_preview は意図通り）
