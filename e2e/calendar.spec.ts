import { expect, test } from "@playwright/test";

import { ephemeralName } from "./constants";

// ログイン済み（storageState）で実行される。
// カレンダーは当月の収支をグリッド表示し、日タップでその日の明細を出す。
// 収支は当日付で登録され、初期選択は今日のため明細が即表示される。

test.describe("カレンダービュー", () => {
  test("当月カレンダーに収支が反映され、月ナビで移動できる", async ({
    page,
  }) => {
    const stamp = Date.now();
    const group = ephemeralName("カレンダー");
    const memo = `カレンダーランチ-${stamp}`;

    // グループ作成 → ダッシュボードへ
    await page.goto("/households");
    await page.getByLabel("グループ名").fill(group);
    await page.getByRole("button", { name: "グループを作成" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // 収支を追加（支出 / 食費 / 1200円・当日付）
    await page.goto("/transactions/new");
    await page.getByLabel("金額").fill("1200");
    await page.getByRole("radio", { name: "食費" }).check();
    await page.getByLabel("メモ").fill(memo);
    await page.getByRole("button", { name: "登録する" }).click();
    await expect(page).toHaveURL(/\/transactions$/);

    // ナビの「カレンダー」から遷移できる
    await page.getByRole("link", { name: "カレンダー" }).first().click();
    await expect(page).toHaveURL(/\/calendar$/);

    // カレンダーグリッドが描画される
    expect(await page.getByTestId("calendar-day").count()).toBeGreaterThanOrEqual(28);

    // 初期選択（今日）の明細に登録した収支が表示される
    await expect(page.getByText(memo)).toBeVisible();
    await expect(page.getByText("食費").first()).toBeVisible();

    // 翌月へ移動すると ?ref= が付き、当該月初には収支が無いため空状態になる
    await page.getByRole("link", { name: "次の期間" }).click();
    await expect(page).toHaveURL(/\/calendar\?ref=/);
    await expect(page.getByText("この日の収支はありません。")).toBeVisible();
  });
});
