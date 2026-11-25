import { expect, test } from "@playwright/test";

import { ephemeralName } from "./constants";
import { createHousehold } from "./helpers";

test("遅い登録の成否を確かめ、削除した収支を元に戻せる", async ({ page }) => {
  test.setTimeout(90_000);
  const group = ephemeralName("登録確認");
  await createHousehold(page, group);
  await page.goto("/transactions/new");
  await expect(page.getByText(group, { exact: true }).last()).toBeVisible();

  await page.route("**/transactions/new", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const original = await route.fetch();
    await new Promise((resolve) => setTimeout(resolve, 13_000));
    await route.fulfill({ response: original });
  });

  const memo = `登録確認 ${Date.now()}`;
  await page.getByLabel("金額").fill("2315");
  await page.getByLabel("メモ").fill(memo);
  await page.getByRole("button", { name: "登録する", exact: true }).click();
  await page.getByRole("button", { name: "登録状況を確認する" }).click({ timeout: 40_000 });
  await expect(page).toHaveURL(/\/transactions$/, { timeout: 20_000 });
  const row = page.getByTestId("transaction-row").filter({ hasText: memo });
  await expect(row).toHaveCount(1);

  await row.getByRole("button", { name: "編集", exact: true }).click();
  await page.getByRole("link", { name: /編集ページを開く/ }).click();
  await page.getByRole("button", { name: "この収支を削除" }).click();
  const undo = page.getByRole("button", { name: "元に戻す", exact: true });
  await expect(undo).toBeVisible();
  await undo.click();
  await expect(page.getByText("収支を元に戻しました", { exact: true })).toBeVisible();
  await expect(row).toHaveCount(1);
});
