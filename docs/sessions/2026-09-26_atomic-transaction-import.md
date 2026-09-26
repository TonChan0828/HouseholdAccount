# 2026-09-26 — Excel取込の原子性

## 目的

- Excel取込でカテゴリだけ作成され、取引が失敗した状態を残さない。
- 同じ household に所属するメンバーが同時に取り込んでも、同名カテゴリを二重作成しない。

## 残存課題の再採点

優先度は `影響度 × 発生可能性 ÷ 修正コスト`（各1〜5）で評価した。

| 課題 | 影響度 | 発生可能性 | 修正コスト | 優先度 | 判断 |
| --- | ---: | ---: | ---: | ---: | --- |
| Excel取込が部分成功し、並行実行でカテゴリ重複が起き得る | 5 | 3 | 2 | 7.5 | 今回対応 |
| 取込済み月の重複検出がない | 3 | 3 | 3 | 3.0 | 利用者が確認できる製品仕様として別途検討 |
| `/categories` 直接作成にDB全体の名前一意性がない | 3 | 2 | 4 | 1.5 | 既存データ統合方針が必要 |

## 変更

- `confirm_transaction_import` RPC を追加し、入力をDBでも再検証する。
- household 所属を確認し、`security invoker` と既存RLSを維持したままDB操作を行う。
- household 単位の transaction advisory lock 下でカテゴリを名前（trim・case-insensitive）と種別で照合し、
  不足分だけ色を循環させて作成する。カテゴリ `both` は従来どおり収入・支出の双方で再利用する。
- カテゴリ作成と取引一括登録を同じRPC呼び出しにまとめ、どちらかが失敗すれば全体をロールバックする。
- Server Action は検証済みの行をRPCへ渡し、成功時だけ revalidate と redirect を行う。
- RPCの実行権限を `authenticated` のみに限定する。

## 検証

- Databaseテストで権限、household越境拒否、既存 `both` カテゴリ再利用、大小文字違いの重複排除、
  transaction挿入失敗時のカテゴリ・取引ロールバックを確認する。
- `supabase/tests/database/atomic_transaction_import.sql`
- E2Eは既存の合成Excel fixtureを使い、成功時の画面反映を確認する。

## 残る制約

- 同じ月を再取込した場合の取引重複は引き続き許容する。
- `/categories` の直接作成や初期カテゴリ作成はこのRPCのadvisory lock外であり、
  household全経路にわたるカテゴリ一意性は保証しない。既存カテゴリ重複を安全に統合する方針も必要。
