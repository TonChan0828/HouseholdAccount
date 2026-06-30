import { expect, test } from "@playwright/test";

import { ephemeralName } from "./constants";

// ログイン済み（storageState）で実行される。
// 新規グループは period_start_day=1 のため、今日付の収支は当期に含まれ予実へ即反映される。

test.describe("予算管理（予実）", () => {
  test("カテゴリに予算を設定すると予実が表示され、超過判定・解除ができる", async ({
    page,
  }) => {
    const group = ephemeralName("予算グループ");
    const memo = `予算テスト-${Date.now()}`;

    // グループ作成（作成者=オーナー、デフォルトカテゴリ付与、アクティブ化）
    await page.goto("/households");
    await page.getByLabel("グループ名").fill(group);
    await page.getByRole("button", { name: "グループを作成" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // 当期の支出を1件登録（食費 / 3000円）→ 予実の実績側になる
    await page.goto("/transactions/new");
    await page.getByLabel("金額").fill("3000");
    await page.getByRole("radio", { name: "食費" }).check();
    await page.getByLabel("メモ").fill(memo);
    await page.getByRole("button", { name: "登録する" }).click();
    await expect(page).toHaveURL(/\/transactions$/);

    // 予算画面へ。食費の予算行を特定する
    await page.goto("/budgets");
    const foodRow = page
      .locator('[data-testid="budget-row"]')
      .filter({ hasText: "食費" });
    await expect(foodRow).toBeVisible();

    // 予算未設定時は当期支出が補助表示される
    await expect(foodRow).toContainText("予算未設定（当期支出 ¥3,000）");

    // 正常系: 予算 5,000 を設定 → 実績3,000 は予算内（60% / 残り ¥2,000）
    await foodRow.getByLabel("食費の予算額").fill("5000");
    await foodRow.getByRole("button", { name: "保存" }).click();
    await expect(foodRow).toContainText("60%");
    await expect(foodRow).toContainText("残り ¥2,000");
    // 合計予算にも反映される
    await expect(page.getByText("当期の合計予算")).toBeVisible();
    await expect(page.getByText("¥5,000").first()).toBeVisible();

    // 異常系（予算超過）: 予算を 2,000 に変更 → 実績3,000 が超過（150% / 超過 +¥1,000）
    await foodRow.getByLabel("食費の予算額").fill("2000");
    await foodRow.getByRole("button", { name: "保存" }).click();
    await expect(foodRow).toContainText("150%");
    await expect(foodRow).toContainText("予算超過 +¥1,000");

    // 解除: 予算をクリアすると未設定表示へ戻る
    await foodRow.getByRole("button", { name: "解除" }).click();
    await expect(foodRow).toContainText("予算未設定（当期支出 ¥3,000）");
  });
});
