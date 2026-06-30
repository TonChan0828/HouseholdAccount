import { expect, test } from "@playwright/test";

import { ephemeralName } from "./constants";

// ログイン済み（storageState）で実行される。
// 貯金額 = 開始日以降の世帯全体の (収入 − 支出)。開始日は当日デフォルトのため、
// 当日付の収入を登録すると進捗に即反映される。

test.describe("貯金目標", () => {
  test("目標を設定すると進捗が表示され、達成・解除まで動作する", async ({
    page,
  }) => {
    const group = ephemeralName("貯金グループ");
    const goalName = `旅行資金-${Date.now()}`;

    // グループ作成（作成者=オーナー、アクティブ化）
    await page.goto("/households");
    await page.getByLabel("グループ名").fill(group);
    await page.getByRole("button", { name: "グループを作成" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // 初期状態: 目標は未設定
    const card = page.locator('[data-testid="savings-goal-card"]');
    await expect(card).toContainText("貯金目標はまだありません");

    // 目標を設定（目標額 10,000・期日なし）
    await card.getByRole("button", { name: "目標を設定" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("目標名").fill(goalName);
    await dialog.getByLabel("目標額").fill("10000");
    await dialog.getByRole("button", { name: "保存" }).click();

    // 収入がまだ無いので 0%・残り全額
    await expect(card).toContainText(goalName);
    await expect(card).toContainText("0%");
    await expect(card).toContainText("残り ¥10,000");

    // 当期に収入 3,000 を登録 → 進捗 30%
    await page.goto("/transactions/new");
    await page.locator('label:has(input[value="income"])').click();
    await page.getByLabel("金額").fill("3000");
    await page.getByRole("radio", { name: "給与" }).check();
    await page.getByRole("button", { name: "登録する" }).click();
    await expect(page).toHaveURL(/\/transactions$/);

    await page.goto("/dashboard");
    await expect(card).toContainText("30%");
    await expect(card).toContainText("残り ¥7,000");

    // さらに収入 7,000 を登録 → 合計 10,000 で目標達成
    await page.goto("/transactions/new");
    await page.locator('label:has(input[value="income"])').click();
    await page.getByLabel("金額").fill("7000");
    await page.getByRole("radio", { name: "給与" }).check();
    await page.getByRole("button", { name: "登録する" }).click();
    await expect(page).toHaveURL(/\/transactions$/);

    await page.goto("/dashboard");
    await expect(card).toContainText("100%");
    await expect(card).toContainText("目標達成");

    // 目標を解除すると未設定表示へ戻る
    await card.getByRole("button", { name: "編集" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "目標を解除" }).click();
    await expect(card).toContainText("貯金目標はまだありません");
  });
});
