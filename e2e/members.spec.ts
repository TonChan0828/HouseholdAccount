import { expect, test } from "@playwright/test";

import { ephemeralName } from "./constants";

// ログイン済み（storageState）で実行される。
// メンバー別アクティビティは当期のメンバー別集計と取引展開を表示する。各テストでグループを作成する。

test.describe("メンバー別アクティビティ", () => {
  test("メンバーカードに当期集計が表示され、クリックで取引を展開できる", async ({
    page,
  }) => {
    const stamp = Date.now();
    const group = ephemeralName("メンバー");
    const memo = `メンバーランチ-${stamp}`;

    // グループ作成（作成者=オーナー、デフォルトカテゴリ付与、アクティブ化）→ ダッシュボードへ
    await page.goto("/households");
    await page.getByLabel("グループ名").fill(group);
    await page.getByRole("button", { name: "グループを作成" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // 収支を追加（支出 / 食費 / 1500円）
    await page.goto("/transactions/new");
    await page.getByLabel("金額").fill("1500");
    await page.getByRole("radio", { name: "食費" }).check();
    await page.getByLabel("メモ").fill(memo);
    await page.getByRole("button", { name: "登録する" }).click();
    await expect(page).toHaveURL(/\/transactions$/);

    // ダッシュボードの「メンバー」リンクから遷移できる
    await page.goto("/dashboard");
    await page.getByRole("link", { name: "メンバー" }).click();
    await expect(page).toHaveURL(/\/members$/);

    // サマリーカードに当期集計が表示される。
    // 作成直後のグループはメンバーが自分だけなのでカードは1枚。
    // 表示名は settings.spec.ts が並列で変更しうるため、値そのものには依存しない。
    const card = page.getByTestId("member-card");
    await expect(card).toBeVisible();
    await expect(card.getByText("¥1,500")).toBeVisible();
    await expect(card.getByText("1件")).toBeVisible();

    // 初期状態では取引一覧は表示されない
    await expect(page.getByText(memo)).not.toBeVisible();

    // カードをクリックすると取引一覧が展開される
    await card.click();
    await expect(page.getByText(/の取引$/)).toBeVisible();
    await expect(page.getByText(memo)).toBeVisible();

    // 再クリックで閉じる
    await card.click();
    await expect(page.getByText(memo)).not.toBeVisible();

    // 次の期間へ移動すると ?ref= が付き、集計は0件になる
    await page.getByRole("link", { name: "次の期間" }).click();
    await expect(page).toHaveURL(/\/members\?ref=/);
    await expect(page.getByText("0件")).toBeVisible();
  });
});
