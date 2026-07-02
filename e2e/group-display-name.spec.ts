import { expect, test } from "@playwright/test";

import { ephemeralName } from "./constants";
import { createHousehold } from "./helpers";

// ログイン済み（storageState）で実行される。
// グループ毎の表示名（ニックネーム）: /households の自分の行で設定でき、
// メンバー一覧とヘッダーに反映され、空保存でグローバル名にフォールバックする。

test.describe("グループ毎の表示名（ニックネーム）", () => {
  test("ニックネームを設定・解除でき、一覧とヘッダーに反映される", async ({
    page,
  }) => {
    const stamp = Date.now();
    const group = ephemeralName("ニックネーム");
    const nickname = `パパ${stamp}`.slice(0, 20);

    // グループ作成（作成者=オーナー・アクティブ化）→ ダッシュボード
    await createHousehold(page, group);

    // 作成したグループのカードに絞り込む
    await page.goto("/households");
    const card = page
      .getByTestId("household-card")
      .filter({ hasText: group });
    await expect(card).toBeVisible();

    // 管理セクションは既定で折り畳まれているため開く
    await card.getByRole("button", { name: /^管理（メンバー/ }).click();

    // 作成直後はメンバーは自分だけ。自分の行でニックネームを設定する。
    await card.getByRole("button", { name: "ニックネーム編集" }).click();
    await card.getByLabel("このグループでの表示名").fill(nickname);
    await card.getByTestId("member-list").getByRole("button", { name: "保存" }).click();

    // メンバー一覧にニックネームが反映される
    await expect(card.getByText(nickname)).toBeVisible();

    // ダッシュボードのヘッダー（利用中グループ）にも反映される
    await page.goto("/dashboard");
    await expect(
      page.getByRole("button", { name: `${nickname} のメニュー` }),
    ).toBeVisible();

    // 空で保存するとニックネームを解除し、グローバル名へフォールバックする
    // （ページ再訪で折り畳みは閉じた状態に戻るため開き直す）
    await page.goto("/households");
    await card.getByRole("button", { name: /^管理（メンバー/ }).click();
    await card.getByRole("button", { name: "ニックネーム編集" }).click();
    await card.getByLabel("このグループでの表示名").fill("");
    await card.getByTestId("member-list").getByRole("button", { name: "保存" }).click();

    // ニックネームは表示されなくなる（メンバー一覧から消える）
    await expect(card.getByText(nickname)).not.toBeVisible();

    // ヘッダーもニックネーム以外（グローバル名）に戻る
    await page.goto("/dashboard");
    await expect(
      page.getByRole("button", { name: `${nickname} のメニュー` }),
    ).not.toBeVisible();
  });
});
