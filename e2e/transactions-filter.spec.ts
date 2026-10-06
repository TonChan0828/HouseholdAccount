import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { ephemeralName } from "./constants";
import { createHousehold } from "./helpers";

// ログイン済み（storageState）で実行される。
// 収支一覧の検索・絞り込み（spec 36）を、種別・カテゴリ・メモ・金額の
// 各条件とクリアの一連のユーザー操作で検証する。

test.describe("収支の検索・絞り込み", () => {
  test("種別・カテゴリ・メモ・金額で絞り込み、クリアで全件に戻せる", async ({
    page,
  }) => {
    const stamp = Date.now();
    const memoFood = `食費ランチ-${stamp}`;
    const memoDaily = `雑貨-${stamp}`;
    const memoIncome = `臨時収入-${stamp}`;
    const rows = page.locator('[data-testid="transaction-row"]');
    const rowBy = (text: string) => rows.filter({ hasText: text });

    await createHousehold(page, ephemeralName("絞り込みグループ"));

    // 3件登録: 支出(食費)1200 / 支出(未選択)800 / 収入(未選択)3000
    await page.goto("/transactions/new");
    await page.getByLabel("金額").fill("1200");
    await page.getByRole("radio", { name: "食費" }).check();
    await page.getByLabel("メモ").fill(memoFood);
    await page.getByRole("button", { name: "登録して続ける" }).click();
    // 件数付きの文言で待つ（"登録しました" だけだと前回のステータスに即マッチする）
    await expect(page.getByRole("status")).toContainText("1件登録しました");

    await page.getByLabel("金額").fill("800");
    await page.getByRole("radio", { name: "未選択" }).check();
    await page.getByLabel("メモ").fill(memoDaily);
    await page.getByRole("button", { name: "登録して続ける" }).click();
    await expect(page.getByRole("status")).toContainText("2件登録しました");

    await page.locator('label:has(input[value="income"])').click();
    await page.getByLabel("金額").fill("3000");
    await page.getByRole("radio", { name: "給与" }).check();
    await page.getByLabel("メモ").fill(memoIncome);
    await page.getByRole("button", { name: "登録する" }).click();

    // 一覧に3件とも表示される
    await expect(page).toHaveURL(/\/transactions$/);
    await expect(rowBy(memoFood)).toBeVisible();
    await expect(rowBy(memoDaily)).toBeVisible();
    await expect(rowBy(memoIncome)).toBeVisible();

    // 種別「支出」で絞り込むと収入行が消える
    await page.getByRole("button", { name: "支出" }).click();
    await expect(page).toHaveURL(/type=expense/);
    await expect(rowBy(memoIncome)).toHaveCount(0);
    await expect(rowBy(memoFood)).toBeVisible();
    await expect(rowBy(memoDaily)).toBeVisible();

    // さらにカテゴリ「食費」で絞り込むと食費の1件だけになる
    await page.getByLabel("カテゴリ").selectOption({ label: "食費" });
    await expect(page).toHaveURL(/category=/);
    await expect(rowBy(memoDaily)).toHaveCount(0);
    await expect(rowBy(memoFood)).toBeVisible();

    // クリアで全件に戻る
    await page.getByRole("button", { name: "クリア" }).click();
    await expect(page).not.toHaveURL(/type=/);
    await expect(rowBy(memoFood)).toBeVisible();
    await expect(rowBy(memoDaily)).toBeVisible();
    await expect(rowBy(memoIncome)).toBeVisible();

    // メモ検索（デバウンス後に反映）で一致する行だけになる
    await page.getByLabel("メモを検索").fill(memoDaily);
    await expect(page).toHaveURL(/q=/);
    await expect(rowBy(memoFood)).toHaveCount(0);
    await expect(rowBy(memoIncome)).toHaveCount(0);
    await expect(rowBy(memoDaily)).toBeVisible();

    // 絞り込んだ記録だけをCSVに出力する
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "CSV出力" }).click();
    const downloadedPath = await (await downloadPromise).path();
    if (!downloadedPath) throw new Error("CSV download is unavailable");
    const csv = readFileSync(downloadedPath, "utf8");
    expect(csv).toContain(memoDaily);
    expect(csv).not.toContain(memoFood);
    expect(csv).not.toContain(memoIncome);

    // カレンダーへ切り替えて戻っても検索条件と表示対象を維持する
    await page.getByRole("main").getByRole("link", { name: "カレンダー", exact: true }).click();
    await expect(page).toHaveURL(/\/calendar\?.*q=/);
    await expect(page.getByText(memoDaily, { exact: true })).toBeVisible();
    await expect(page.getByText(memoFood, { exact: true })).toHaveCount(0);
    await page.getByRole("main").getByRole("link", { name: "リスト", exact: true }).click();
    await expect(page).toHaveURL(/\/transactions\?.*q=/);
    await expect(rowBy(memoDaily)).toBeVisible();
    await expect(rowBy(memoFood)).toHaveCount(0);

    // 検索語をクリアして金額下限 1000 円で絞り込むと 800 円の行が消える
    await page.getByRole("button", { name: "クリア" }).click();
    await expect(page).not.toHaveURL(/q=/);
    await page.getByLabel("金額(下限)").fill("1000");
    await expect(page).toHaveURL(/min=1000/);
    await expect(rowBy(memoDaily)).toHaveCount(0);
    await expect(rowBy(memoFood)).toBeVisible();
    await expect(rowBy(memoIncome)).toBeVisible();
  });

  test("条件に一致しない場合は空状態とクリア導線を表示する", async ({
    page,
  }) => {
    const stamp = Date.now();
    const memo = `唯一の記録-${stamp}`;

    await createHousehold(page, ephemeralName("絞り込み空グループ"));

    await page.goto("/transactions/new");
    await page.getByLabel("金額").fill("500");
    await page.getByLabel("メモ").fill(memo);
    await page.getByRole("button", { name: "登録する" }).click();
    await expect(page).toHaveURL(/\/transactions$/);

    // 一致しないキーワードで検索すると空状態になる
    await page.getByLabel("メモを検索").fill(`存在しない-${stamp}`);
    await expect(
      page.getByText("条件に一致する収支がありません。"),
    ).toBeVisible();

    // 「条件をクリア」で全件表示に戻る
    await page.getByRole("link", { name: "条件をクリア" }).click();
    await expect(
      page.locator('[data-testid="transaction-row"]').filter({ hasText: memo }),
    ).toBeVisible();
  });
});
