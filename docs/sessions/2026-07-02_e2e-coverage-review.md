# 2026-07-02 — E2Eテストの過不足解消

## やったこと

- E2E 全24スペックと `docs/user-stories.md`・各仕様書を突き合わせ、過不足をレビュー
  - 過剰はなし。不足は「招待リンクからの参加実行」が最大のギャップと判定
- `e2e/household.spec.ts` に「招待リンクから別ユーザーが参加でき、参加者は自分で脱退できる」を追加
  - 第2ユーザー（E2E_MEMBER_USER）を別ブラウザコンテキストでログインさせ、
    招待リンクから参加 → オーナー側のメンバー一覧反映 → 本人の脱退まで実行検証
- `docs/specs/06_household.md` の「multi-user 参加は SQL 検証に留める」記述を解消済みに更新
  （実際には SQL 検証も存在しなかったため、実態と仕様書のズレを解消）
- `docs/user-stories.md` を更新
  - row 06: 参加・脱退ストーリーを追記
  - row 13: `password-form.test.tsx`（ログイン中のパスワード変更）を Unit として明記
  - row 15: 委譲・除外は表示まで／脱退は実行まで、と検証範囲を明記
  - row 32: 期日ペース・バリデーションのユニット代替（`lib/savings-goal.test.ts` 等）を明記
  - 補足欄: 除外・委譲の非破壊方針、ログイン中パスワード変更を E2E にしない根拠を追加
- `CLAUDE.md` の analytics「メンバー別切り替えあり」を実態（未実装・将来課題）に修正
- `e2e/helpers.ts` に `createHousehold(page, name)` を抽出し、
  全スペック約28箇所のグループ作成ボイラープレートを置換（codemod で機械置換）

## 決めたこと・理由

- メンバー除外・オーナー委譲の「実行」は E2E にしない（共有フィクスチャ
  MULTI_MEMBER_HOUSEHOLD を壊すため）。表示までを E2E、実行はコンポーネントテストで担保
- ログイン中のパスワード変更も E2E にしない（共有ユーザーの資格情報変更は失敗時に
  後続テストが全滅するリスク）。`password-form.test.tsx` のユニットで担保し対応表に明記
- ヘルパーは「生成済みの名前を受け取って UI 操作だけを行う」形（`createHousehold`）にした。
  名前生成（`ephemeralName`）をテスト側に残すことで、ロケータ・メモとの共有が自然になり
  機械置換も安全になるため

## ハマりどころ

- `@playwright/test` の `browser.newContext()` はプロジェクトの contextOptions
  （storageState 含む）を継承する。第2ユーザー用の未認証コンテキストには
  `storageState: { cookies: [], origins: [] }` の明示が必要（初回実行で1件失敗→修正）

## 次にやること

- コミット（feat/test/docs で目的別に分割するか要検討）

## 検証結果

- `npm run lint` / `npm run typecheck`: 通過
- `npm run test:run`: 92ファイル 581件 通過
- `npx playwright test --workers=1`: **54件全通過（3.9分）**
  - 2回目の実行で settings.spec.ts が `page.goto("/households")` の30秒ロード待ちで
    フレークしたが、コードは動作等価（3回目で全通過）。dev サーバー遅延起因

## 未解決の課題

- `household.spec.ts` の「グループを作成すると利用中になり…」テスト内の連続作成
  （/households 画面上で goto なしに2つ目を作成）はヘルパー対象外として残置（意図的）
