import { expect, test } from "@playwright/test";

import { ephemeralName } from "./constants";
import { createHousehold, openTransactionDialog } from "./helpers";

// ログイン済み（storageState）で実行される。
// 反映には2つ以上の所属グループが必要なため、各テストで一時グループを2つ作る。

test.describe("収支のグループ間反映", () => {
  const card = (page: import("@playwright/test").Page, name: string) =>
    page.locator('[data-testid="household-card"]').filter({ hasText: name });

  const row = (page: import("@playwright/test").Page, memo: string) =>
    page.locator('[data-testid="transaction-row"]').filter({ hasText: memo });

  test("追加モーダルから他グループへ同時反映できる", async ({ page }) => {
    const stamp = Date.now();
    const groupA = ephemeralName("反映先A");
    const groupB = ephemeralName("反映元B");
    const memo = `反映-${stamp}`;

    // A → B の順で作成（最後に作った B がアクティブになる）
    await createHousehold(page, groupA);
    await createHousehold(page, groupB);

    // B（アクティブ）で収支を登録し、A にも反映する（追加モーダル経由・spec 40）
    await page.goto("/transactions");
    const dialog = await openTransactionDialog(
      page,
      page.getByRole("button", { name: "収支を追加" }),
    );
    await dialog.getByLabel("金額").fill("1500");
    await dialog.getByRole("radio", { name: "食費" }).check();
    await dialog.getByLabel("メモ").fill(memo);
    await dialog
      .locator("summary")
      .filter({ hasText: "他のグループにも反映する" })
      .click();
    await dialog.getByRole("checkbox", { name: groupA }).check();
    await dialog.getByRole("button", { name: "登録する" }).click();

    // モーダルが閉じ、反映元 B に表示される
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/transactions$/);
    await expect(row(page, memo)).toContainText("¥1,500");

    // A に切り替えると、反映された収支が表示される
    await page.goto("/households");
    await card(page, groupA)
      .getByRole("button", { name: "このグループに切り替え" })
      .click();
    await expect(card(page, groupA).getByTestId("active-badge")).toHaveText(
      "利用中",
    );
    await page.goto("/transactions");
    await expect(row(page, memo)).toContainText("¥1,500");
  });

  test("既存の収支を編集モーダルから後追いで反映できる", async ({ page }) => {
    const stamp = Date.now();
    const groupC = ephemeralName("元C");
    const groupD = ephemeralName("反映先D");
    const memo = `後追い-${stamp}`;

    // C → D の順で作成
    await createHousehold(page, groupC);
    await createHousehold(page, groupD);

    // C をアクティブに戻して C で登録（反映なし）
    await page.goto("/households");
    await card(page, groupC)
      .getByRole("button", { name: "このグループに切り替え" })
      .click();
    await expect(card(page, groupC).getByTestId("active-badge")).toHaveText(
      "利用中",
    );

    await page.goto("/transactions/new");
    await page.getByLabel("金額").fill("800");
    await page.getByLabel("メモ").fill(memo);
    await page.getByRole("button", { name: "登録する" }).click();
    await expect(page).toHaveURL(/\/transactions$/);

    // 編集モーダルから D へ後追い反映（spec 40）
    const dialog = await openTransactionDialog(
      page,
      row(page, memo).getByRole("button", { name: "編集" }),
    );
    await dialog.getByRole("checkbox", { name: groupD }).check();
    await dialog.getByRole("button", { name: "選択したグループへ反映" }).click();
    await expect(dialog.getByRole("status")).toContainText("反映しました");

    // D に切り替えると、反映された収支が表示される
    await page.goto("/households");
    await card(page, groupD)
      .getByRole("button", { name: "このグループに切り替え" })
      .click();
    await expect(card(page, groupD).getByTestId("active-badge")).toHaveText(
      "利用中",
    );
    await page.goto("/transactions");
    await expect(row(page, memo)).toContainText("¥800");
  });

  test("反映先にカテゴリがなければ警告し、元のカテゴリを表示する", async ({ page }) => {
    const target = ephemeralName("未分類の反映先");
    const source = ephemeralName("未分類の反映元");
    const memo = `元カテゴリ確認 ${Date.now()}`;
    const category = "専用の水道代";
    await createHousehold(page, target);
    await createHousehold(page, source);

    await page.goto("/categories/new");
    await page.getByLabel("カテゴリ名").fill(category);
    await page.getByRole("radio", { name: "支出" }).check();
    await page.getByRole("button", { name: "追加する" }).click();
    await expect(page).toHaveURL(/\/categories$/);

    await page.goto("/transactions/new");
    await page.getByLabel("金額").fill("2315");
    await page.getByLabel("メモ").fill(memo);
    await page.getByRole("radio", { name: category }).check();
    await page.locator("summary").filter({ hasText: "他のグループにも反映する" }).click();
    await page.getByRole("checkbox", { name: target }).check();
    await page.getByRole("button", { name: "登録する", exact: true }).click();
    await expect(page.getByText(/「専用の水道代」がないため、未分類で反映しました/)).toBeVisible();

    await page.goto("/households");
    await card(page, target).getByRole("button", { name: "このグループに切り替え" }).click();
    await expect(card(page, target).getByTestId("active-badge")).toHaveText("利用中");
    await page.goto("/transactions");
    await expect(row(page, memo)).toContainText("反映元のカテゴリ：専用の水道代");
  });
});
