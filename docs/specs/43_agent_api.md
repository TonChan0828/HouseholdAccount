# エージェント向け家計簿 API

設定の「エージェント API」でトークンを発行します。秘密値は発行時のみ確認できます。すべてのリクエストに `Authorization: Bearer <token>` を付けてください。トークンには、発行者が現在所属するグループの閲覧と登録が許可されます。更新と削除の対象は発行者が登録した収支です。

| メソッドとパス | 入力と結果 |
| --- | --- |
| `GET /api/agent/groups` | 所属グループの ID、名前、期間開始日、メンバーの ID と表示名を返します。 |
| `GET /api/agent/categories?group=<id>` | カテゴリの ID、名前、種別、プリセットと非表示の区分を返します。 |
| `GET /api/agent/transactions` | `group` と `period=YYYY-MM`、または `group` と `start`・`endExclusive` を指定します。`category` と `member` で絞り込めます。 |
| `POST /api/agent/transactions` | `Idempotency-Key` ヘッダーと JSON を指定します。作成した収支の ID と影響した全グループ・期間の集計を返します。 |
| `PATCH /api/agent/transactions/<id>` | JSON で `categoryId`、`amount`、`date`、`memo`、`memberId` のうち変更する項目を指定します。 |
| `DELETE /api/agent/transactions/<id>` | 削除した ID と同じグループ・期間の削除後の集計を返します。 |

期間開始日が25日のグループで `period=2026-11` を指定した場合、11月25日から12月24日までの収支を返します。明細は `items` に新しい日付順で入ります。`limit` は1〜100件で、既定は100件です。`next` に値があれば、次のリクエストで `next.date` を `beforeDate` に、`next.id` を `beforeId` に指定します。`totals` は期間と絞り込み条件に一致する全明細の件数・収入・支出・差額です。

単件登録は `groupId` と収支項目を同じ JSON オブジェクトに指定します。一括登録は同じグループの収支を `entries` に1〜100件指定します。

```json
{
  "groupId": "00000000-0000-4000-8000-000000000001",
  "entries": [
    {
      "date": "2026-11-25",
      "type": "expense",
      "amount": 2315,
      "categoryId": "00000000-0000-4000-8000-000000000002",
      "memo": "水道代"
    }
  ]
}
```

日付・種別・金額は必須です。金額は正の整数で指定します。カテゴリ・名義人・メモは省略できます。名義人の省略時は発行者本人になります。同じ発行者が同じキーと内容を再送すると、作成時に保存した結果を返します。内容を変えて同じキーを使うと `409 idempotency_conflict` を返します。

振り分けを使う場合は、設定画面で3グループを指定し、取引ごとに `routing` を付けます。`target` は `home` または `personal`、`payment` は `aeon_pay`、`aeon_card`、`other` です。水道代と水道光熱費のように名前が異なるカテゴリは、設定画面のカテゴリ対応にそれぞれの ID を登録してください。条件やカテゴリがそろわない場合は、原因を返し、元の収支も反映分も登録を取り消します。

エラーの本文は `{"error":{"code":"…","message":"…"}}` です。利用者にメッセージを表示し、プログラムではコードを判定に使ってください。
