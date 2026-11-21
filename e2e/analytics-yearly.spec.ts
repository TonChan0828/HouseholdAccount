import { expect, test, type Page } from "@playwright/test";

import { ephemeralName } from "./constants";
import { createHousehold } from "./helpers";

// ログイン済み（storageState）で実行される。
// 年間分析（spec 42）: 分析画面の「年間」タブで締め日考慮の12期を集計し、前年同期と比較する。
// 新規グループは period_start_day=1 のため、年＝暦年になる。

/** 支出を指定日付で登録する。 */
async function addExpense(page: Page, amount: string, date: string) {
  await page.goto("/transactions/new");
  await page.getByLabel("金額").fill(amount);
  await page.getByLabel("日付").fill(date);
  await page.getByRole("radio", { name: "食費" }).check();
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page).toHaveURL(/\/transactions$/);
}

test.describe("年間分析", () => {
  test("年間タブで今年の集計と前年同期比を確認し、前年へ移動できる", async ({
    page,
  }) => {
    const group = ephemeralName("年間分析");
    await createHousehold(page, group);

    // 今年と前年の「同じ月日」に支出を登録する（前年同期の範囲に確実に入るよう日は28以下に丸める）。
    const now = new Date();
    const year = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(Math.min(now.getDate(), 28)).padStart(2, "0");
    await addExpense(page, "30000", `${year}-${mm}-${dd}`);
    await addExpense(page, "10000", `${year - 1}-${mm}-${dd}`);

    // 分析 → 「年間」タブ
    await page.goto("/analytics");
    await page.getByRole("link", { name: "年間" }).click();
    await expect(page).toHaveURL(/\/analytics\?view=year$/);
    await expect(page.getByRole("link", { name: "年間" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.getByText(`${year}年`, { exact: true })).toBeVisible();

    // セクション見出し
    await expect(page.getByText("月別推移（12期）")).toBeVisible();
    await expect(page.getByText("カテゴリ別支出（年間）")).toBeVisible();
    await expect(page.getByText("前年比較", { exact: true })).toBeVisible();

    // カテゴリ別（年間）は今年分のみ
    const categorySection = page.getByRole("region", {
      name: "カテゴリ別支出（年間）",
    });
    await expect(
      categorySection.getByText("¥30,000", { exact: true }),
    ).toBeVisible();

    await expect(categorySection.getByText("1件", { exact: true })).toBeVisible();

    // 前年同期比: 支出 ¥10,000 → ¥30,000（+¥20,000 / +200%）
    const yoy = page.getByTestId("yoy-total-expense");
    await expect(yoy.getByText("+¥20,000", { exact: true })).toBeVisible();
    await expect(yoy.getByText("+200%", { exact: true })).toBeVisible();

    // 年間アドバイス（前年同期比の支出増）
    await expect(page.getByText("年間アドバイス")).toBeVisible();
    await expect(
      page.getByText("支出が前年同期比 +200% 増えています"),
    ).toBeVisible();

    // 前年へ移動すると前年分のみになり、さらに前の年のデータは無い
    await page.getByRole("link", { name: "前の期間" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/analytics\\?view=year&year=${year - 1}$`),
    );
    await expect(
      page.getByText(`${year - 1}年`, { exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "カテゴリ別支出（年間）" })
        .getByText("¥10,000", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("前年のデータがありません。")).toBeVisible();

    // 「月次」タブで従来の月次ビューに戻れる
    await page.getByRole("link", { name: "月次" }).click();
    await expect(page).toHaveURL(/\/analytics$/);
    await expect(page.getByText("月別推移（直近6期）")).toBeVisible();
  });
});
