import { expect, test, type Page } from "@playwright/test";

import { ephemeralName } from "./constants";
import { createHousehold, openTransactionDialog } from "./helpers";

/** カテゴリ一覧で確認ダイアログを開いて「削除する」を押し、完了表示まで確認する。 */
async function deleteCategoryViaDialog(page: Page, name: string) {
  const row = page
    .locator('[data-testid="category-row"]')
    .filter({ hasText: name });
  const dialog = page.getByRole("dialog", { name: "カテゴリを削除しますか？" });
  // ハイドレーション前のクリック空振りに備えて開くまで再試行する。
  await expect(async () => {
    await row.getByRole("button", { name: `${name}を削除` }).click();
    await expect(dialog).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  await dialog.getByRole("button", { name: "削除する" }).click();
  await expect(page).toHaveURL(/\/categories\?deleted=1$/);
  await expect(page.getByTestId("category-deleted-notice")).toHaveText(
    "カテゴリを削除しました。",
  );
  await expect(row).toHaveCount(0);
}

// ログイン済み（storageState）で実行される。
// カテゴリはグループ共有のため、各テストでグループを作成する。

test.describe("カテゴリ管理", () => {
  test("カテゴリを追加・編集・削除でき、収支フォームに反映される", async ({
    page,
  }) => {
    const stamp = Date.now();
    const group = ephemeralName("カテゴリ");
    const name = `ペット-${stamp}`;
    const renamed = `ペット改-${stamp}`;

    // グループ作成（デフォルトカテゴリ付与、アクティブ化）
    await createHousehold(page, group);

    // カテゴリを追加（支出）
    await page.goto("/categories/new");
    await page.getByLabel("カテゴリ名").fill(name);
    await page.getByRole("radio", { name: "支出" }).check();
    const petIcon = page.getByRole("radio", { name: "アイコン: ペット" });
    await petIcon.locator("xpath=..").click();
    await expect(petIcon).toBeChecked();
    await page.getByRole("button", { name: "追加する" }).click();

    // 一覧に表示される
    await expect(page).toHaveURL(/\/categories$/);
    const row = page
      .locator('[data-testid="category-row"]')
      .filter({ hasText: name });
    await expect(row).toBeVisible();
    await expect(row.locator("svg.lucide-paw-print")).toBeVisible();

    // 前後空白・大文字小文字を正規化した同種別の重複名はDBで拒否する
    await page.goto("/categories/new");
    await page.getByLabel("カテゴリ名").fill(`  ${name}  `);
    await page.getByRole("radio", { name: "支出" }).check();
    await page.getByRole("button", { name: "追加する" }).click();
    await expect(page.locator('p[role="alert"]')).toHaveText(
      "同じ種別のカテゴリに同じ名前が既にあります",
    );

    // 重複エラーでは追加画面に留まる。一覧に戻って登録件数と既存行を確認する。
    await expect(page).toHaveURL(/\/categories\/new$/);
    await page.goto("/categories");
    await expect(row).toHaveCount(1);

    // デフォルトカテゴリには操作ボタンが無い
    const defaultRow = page
      .locator('[data-testid="category-row"]')
      .filter({ hasText: "食費" });
    await expect(defaultRow.getByText("デフォルト")).toBeVisible();
    await expect(defaultRow.getByRole("link", { name: "編集" })).toHaveCount(0);

    // 収支フォームの選択肢に反映される
    await page.goto("/transactions/new");
    await expect(
      page.getByRole("radio", { name }),
    ).toBeVisible();

    // 編集して名前を変更
    await page.goto("/categories");
    await row.getByRole("link", { name: "編集" }).click();
    await expect(page).toHaveURL(/\/categories\/.+\/edit$/);
    await expect(page.getByRole("radio", { name: "アイコン: ペット" })).toBeChecked();
    const travelIcon = page.getByRole("radio", { name: "アイコン: 旅行" });
    await travelIcon.locator("xpath=..").click();
    await expect(travelIcon).toBeChecked();
    await page.getByLabel("カテゴリ名").fill(renamed);
    await page.getByRole("button", { name: "更新する" }).click();

    await expect(page).toHaveURL(/\/categories$/);
    const renamedRow = page
      .locator('[data-testid="category-row"]')
      .filter({ hasText: renamed });
    await expect(renamedRow).toBeVisible();
    await expect(renamedRow.locator("svg.lucide-plane")).toBeVisible();

    // 確認ダイアログで「削除する」を押すと一覧から消え、再読み込み後も復活しない
    await deleteCategoryViaDialog(page, renamed);
    await page.reload();
    await expect(
      page
        .locator('[data-testid="category-row"]')
        .filter({ hasText: renamed }),
    ).toHaveCount(0);
  });

  test("収支で使われているカテゴリを削除すると永続化され、収支は未選択になり選択肢からも消える", async ({
    page,
  }) => {
    const stamp = Date.now();
    const name = `削除検証-${stamp}`;
    const memo = `削除検証メモ-${stamp}`;
    const categoryRows = page
      .locator('[data-testid="category-row"]')
      .filter({ hasText: name });

    await createHousehold(page, ephemeralName("カテゴリ削除"));

    await page.goto("/categories/new");
    await page.getByLabel("カテゴリ名").fill(name);
    await page.getByRole("radio", { name: "支出" }).check();
    await page.getByRole("button", { name: "追加する" }).click();
    await expect(page).toHaveURL(/\/categories$/);
    await expect(categoryRows).toHaveCount(1);

    // このカテゴリで収支を1件登録する
    await page.goto("/transactions/new");
    await page.getByLabel("金額").fill("1500");
    await page.getByRole("radio", { name }).check();
    await page.getByLabel("メモ").fill(memo);
    await page.getByRole("button", { name: "登録する" }).click();
    await expect(page).toHaveURL(/\/transactions$/);
    const txRow = page
      .locator('[data-testid="transaction-row"]')
      .filter({ hasText: memo });
    await expect(txRow).toContainText(name);

    // キャンセルでは削除されない
    await page.goto("/categories");
    const trigger = categoryRows.getByRole("button", { name: `${name}を削除` });
    const dialog = page.getByRole("dialog", { name: "カテゴリを削除しますか？" });
    await expect(async () => {
      await trigger.click();
      await expect(dialog).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    await expect(dialog).toContainText("「未選択」に変更されます");
    await dialog.getByRole("button", { name: "キャンセル" }).click();
    await expect(dialog).toHaveCount(0);
    await page.reload();
    await expect(categoryRows).toHaveCount(1);

    // 削除すると成功が表示され、再読み込み・画面遷移後も復活しない
    await deleteCategoryViaDialog(page, name);
    await page.reload();
    await expect(categoryRows).toHaveCount(0);
    await page.goto("/dashboard");
    await page.goto("/categories");
    await expect(categoryRows).toHaveCount(0);

    // 収支は残り、カテゴリは未分類（編集フォームでは「未選択」）になる
    await page.goto("/transactions");
    await expect(txRow).toBeVisible();
    await expect(txRow).toContainText("未分類");
    await expect(txRow).not.toContainText(name);
    const editDialog = await openTransactionDialog(
      page,
      txRow.getByRole("button", { name: "編集" }),
    );
    await expect(editDialog.getByRole("radio", { name: "未選択" })).toBeChecked();
    await expect(editDialog.getByRole("radio", { name })).toHaveCount(0);
    await page.keyboard.press("Escape");

    // 収支一覧のカテゴリ絞り込みの選択肢にも出ない
    await expect(
      page.getByLabel("カテゴリ").locator("option", { hasText: name }),
    ).toHaveCount(0);

    // 収支登録画面の選択肢にも出ない
    await page.goto("/transactions/new");
    await expect(page.getByRole("radio", { name: "食費" })).toBeVisible();
    await expect(page.getByRole("radio", { name })).toHaveCount(0);
  });

  test("通知ONにしたカテゴリの登録漏れが月末3日以内にダッシュボードで警告され、記録すると消える", async ({
    page,
  }) => {
    const group = ephemeralName("カテゴリ通知");
    const longCategoryName = `UnbrokenCategory${Date.now()}`;
    const householdCard = page
      .locator('[data-testid="household-card"]')
      .filter({ hasText: group });

    await createHousehold(page, group);

    // デフォルトカテゴリ「住居費」の通知をONにする（デフォルトにもトグルが付けられる）
    await page.goto("/categories");

    // トグルの意味を説明するノートが常時表示されている
    const note = page.getByTestId("category-reminder-note");
    await expect(note).toBeVisible();
    await expect(note).toContainText("通知ONにすると");
    await expect(note).toContainText("ダッシュボードでお知らせします");

    const housingRow = page
      .locator('[data-testid="category-row"]')
      .filter({ hasText: "住居費" });
    await expect(
      housingRow.getByTestId("category-reminder-toggle"),
    ).toHaveText("通知OFF");
    await housingRow.getByTestId("category-reminder-toggle").click();
    await expect(
      housingRow.getByTestId("category-reminder-toggle"),
    ).toHaveText("通知ON");

    // 長いカテゴリ名も通知対象に含め、ダッシュボードでカード幅に収まることを確認する。
    await page.goto("/categories/new");
    await page.getByLabel("カテゴリ名").fill(longCategoryName);
    await page.getByRole("radio", { name: "支出" }).check();
    await page.getByRole("button", { name: "追加する" }).click();
    await expect(page).toHaveURL(/\/categories$/);
    const longCategoryRow = page
      .locator('[data-testid="category-row"]')
      .filter({ hasText: longCategoryName });
    await expect(longCategoryRow).toBeVisible();
    await longCategoryRow.getByTestId("category-reminder-toggle").click();
    await expect(
      longCategoryRow.getByTestId("category-reminder-toggle"),
    ).toHaveText("通知ON");

    // 「開始日」を今日から逆算し、当期の残り日数を閾値（3日）以内に追い込む。
    // period_start_day は 1〜28 のみ許容。end（=開始日と同じ日付）が
    // today+k（k=4..1）になるよう、1〜28に収まる最大の k を探す（daysRemaining=k-1）。
    // k=1（daysRemaining=0＝今日が期末当日）は避ける: 収支フォームの日付初期値は
    // ブラウザのローカルTZ基準（lib/period.ts#localToday）、期間計算はサーバのUTC
    // 基準（lib/period.ts#getPeriodRange）のため、境界ちょうどだとTZのずれで
    // 登録した収支が当期の外に出てしまう恐れがある。k=4 に寄せて余裕を持たせる。
    const today = new Date();
    let startDay = -1;
    for (let k = 4; k >= 1; k--) {
      const candidate = new Date(
        Date.UTC(
          today.getUTCFullYear(),
          today.getUTCMonth(),
          today.getUTCDate() + k,
        ),
      ).getUTCDate();
      if (candidate <= 28) {
        startDay = candidate;
        break;
      }
    }
    expect(startDay).toBeGreaterThan(0);

    await page.goto("/households");
    await householdCard
      .getByRole("button", { name: /^管理（メンバー/ })
      .click();
    await householdCard.getByLabel("開始日（1〜28）").fill(String(startDay));
    const saveResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/households",
    );
    const periodSettingsForm = householdCard
      .getByLabel("開始日（1〜28）")
      .locator("xpath=ancestor::form");
    await periodSettingsForm.getByRole("button", { name: "保存" }).click();
    const response = await saveResponse;
    expect(response.ok()).toBe(true);
    expect(await response.finished()).toBeNull();

    // 「住居費」の登録が無いため、ダッシュボードにリマインダーが表示される
    await page.goto("/dashboard");
    const reminder = page.getByTestId("unrecorded-categories-reminder");
    await expect(reminder).toBeVisible();
    await expect(reminder).toContainText("まだ登録がありません");
    await expect(reminder).toContainText("住居費");
    const longCategoryChip = reminder.getByText(longCategoryName);
    await expect(longCategoryChip).toBeVisible();
    const chipFitsCard = await longCategoryChip.evaluate((chip) => {
      const card = chip.closest('[data-testid="unrecorded-categories-reminder"]');
      if (!card) return false;
      return chip.getBoundingClientRect().right <= card.getBoundingClientRect().right;
    });
    expect(chipFitsCard).toBe(true);
    await expect(reminder).toContainText(/残り\d+日/);

    // まず「住居費」を記録する。長いカテゴリは未記録なので通知は残る。
    await reminder.getByRole("link", { name: "収支を記録" }).click();
    await page.getByLabel("金額").fill("85000");
    await page.getByRole("radio", { name: "住居費" }).check();
    await page.getByRole("button", { name: "登録する" }).click();
    await expect(page).toHaveURL(/\/transactions$/);

    await page.goto("/dashboard");
    await expect(reminder).toBeVisible();
    await expect(reminder).toContainText(longCategoryName);
    await expect(reminder).not.toContainText("住居費");

    // 長いカテゴリも記録すると、登録漏れがなくなり通知カードが消える。
    await reminder.getByRole("link", { name: "収支を記録" }).click();
    await page.getByLabel("金額").fill("1000");
    await page.getByRole("radio", { name: longCategoryName }).check();
    await page.getByRole("button", { name: "登録する" }).click();
    await expect(page).toHaveURL(/\/transactions$/);

    await page.goto("/dashboard");
    await expect(
      page.getByTestId("unrecorded-categories-reminder"),
    ).toHaveCount(0);
  });
});
