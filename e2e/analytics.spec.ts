import { expect, test } from "@playwright/test";

import { ephemeralName } from "./constants";

// ログイン済み（storageState）で実行される。
// 分析は当期の支出カテゴリ内訳と直近6期の推移を表示する。各テストでグループを作成する。

test.describe("月次分析", () => {
  test("収支を追加すると分析に反映され、期間ナビで移動できる", async ({
    page,
  }) => {
    const stamp = Date.now();
    const group = ephemeralName("分析");
    const memo = `分析ランチ-${stamp}`;

    // グループ作成（作成者=オーナー、デフォルトカテゴリ付与、アクティブ化）→ ダッシュボードへ
    await page.goto("/households");
    await page.getByLabel("グループ名").fill(group);
    await page.getByRole("button", { name: "グループを作成" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // 収支を追加（支出 / 食費 / 1200円）
    await page.goto("/transactions/new");
    await page.getByLabel("金額").fill("1200");
    await page.getByRole("radio", { name: "食費" }).check();
    await page.getByLabel("メモ").fill(memo);
    await page.getByRole("button", { name: "登録する" }).click();
    await expect(page).toHaveURL(/\/transactions$/);

    // ダッシュボードの「分析」リンクから遷移できる
    await page.goto("/dashboard");
    await page.getByRole("link", { name: "分析" }).click();
    await expect(page).toHaveURL(/\/analytics$/);

    // セクション見出しが表示される
    await expect(page.getByText("月別推移（直近6期）")).toBeVisible();
    await expect(page.getByText("カテゴリ別支出（当期）")).toBeVisible();

    // カテゴリ別内訳の凡例に食費と金額が反映される
    // （家計アドバイス内にも同額が出るため、凡例の金額は完全一致で絞り込む）
    await expect(page.getByText("食費").first()).toBeVisible();
    await expect(page.getByText("¥1,200", { exact: true })).toBeVisible();

    // 次の期間へ移動すると ?ref= が付き、当期支出が無いためプレースホルダになる
    await page.getByRole("link", { name: "次の期間" }).click();
    await expect(page).toHaveURL(/\/analytics\?ref=/);
    await expect(page.getByText("当期の支出はまだありません。")).toBeVisible();
  });
});
