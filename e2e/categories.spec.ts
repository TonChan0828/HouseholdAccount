import { expect, test } from "@playwright/test";

import { ephemeralName } from "./constants";
import { createHousehold } from "./helpers";

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
    await page.getByRole("button", { name: "追加する" }).click();

    // 一覧に表示される
    await expect(page).toHaveURL(/\/categories$/);
    const row = page
      .locator('[data-testid="category-row"]')
      .filter({ hasText: name });
    await expect(row).toBeVisible();

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
    await page.getByLabel("カテゴリ名").fill(renamed);
    await page.getByRole("button", { name: "更新する" }).click();

    await expect(page).toHaveURL(/\/categories$/);
    const renamedRow = page
      .locator('[data-testid="category-row"]')
      .filter({ hasText: renamed });
    await expect(renamedRow).toBeVisible();

    // 削除（confirm 承諾）で一覧から消える
    page.once("dialog", (dialog) => dialog.accept());
    await renamedRow.getByRole("button", { name: "削除" }).click();
    await expect(
      page
        .locator('[data-testid="category-row"]')
        .filter({ hasText: renamed }),
    ).toHaveCount(0);
  });

  test("通知ONにしたカテゴリの登録漏れが月末3日以内にダッシュボードで警告され、記録すると消える", async ({
    page,
  }) => {
    const group = ephemeralName("カテゴリ通知");
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
    await householdCard.getByRole("button", { name: "保存" }).click();
    const response = await saveResponse;
    expect(response.ok()).toBe(true);
    expect(await response.finished()).toBeNull();

    // 「住居費」の登録が無いため、ダッシュボードにリマインダーが表示される
    await page.goto("/dashboard");
    const reminder = page.getByTestId("unrecorded-categories-reminder");
    await expect(reminder).toBeVisible();
    await expect(reminder).toContainText("まだ登録がありません");
    await expect(reminder).toContainText("住居費");
    await expect(reminder).toContainText(/残り\d+日/);

    // 「住居費」で収支を1件記録すると、次のダッシュボード訪問でリマインダーが消える
    await reminder.getByRole("link", { name: "収支を記録" }).click();
    await page.getByLabel("金額").fill("85000");
    await page.getByRole("radio", { name: "住居費" }).check();
    await page.getByRole("button", { name: "登録する" }).click();
    await expect(page).toHaveURL(/\/transactions$/);

    await page.goto("/dashboard");
    await expect(
      page.getByTestId("unrecorded-categories-reminder"),
    ).toHaveCount(0);
  });
});
