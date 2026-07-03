import { expect, test } from "@playwright/test";

import { E2E_MEMBER_USER, ephemeralName } from "./constants";
import { createHousehold } from "./helpers";

// ログイン済み（storageState）で実行される。
// 新規グループは period_start_day=1 のため、今日付の収支は当期に含まれる。

test.describe("メンバー間精算（割り勘）", () => {
  test("精算対象の支出を均等割りし、送金案の表示と精算の確定・取り消しができる", async ({
    page,
    browser,
    baseURL,
  }) => {
    const group = ephemeralName("精算グループ");
    const card = page
      .locator('[data-testid="household-card"]')
      .filter({ hasText: group });

    // オーナーがグループを作成し、精算対象の支出（3000円）と対象外の支出（500円）を登録
    await createHousehold(page, group);

    await page.goto("/transactions/new");
    await page.getByLabel("金額").fill("3000");
    await page.getByRole("radio", { name: "食費" }).check();
    await page.getByRole("checkbox", { name: /精算対象（割り勘）/ }).check();
    await page.getByRole("button", { name: "登録する" }).click();
    await expect(page).toHaveURL(/\/transactions$/);

    await page.goto("/transactions/new");
    await page.getByLabel("金額").fill("500");
    await page.getByRole("button", { name: "登録する" }).click();
    await expect(page).toHaveURL(/\/transactions$/);

    // 一覧では精算対象の行にのみ「精算」バッジが付く
    const sharedRow = page
      .locator('[data-testid="transaction-row"]')
      .filter({ hasText: "¥3,000" });
    await expect(sharedRow.getByText("精算", { exact: true })).toBeVisible();
    const normalRow = page
      .locator('[data-testid="transaction-row"]')
      .filter({ hasText: "¥500" });
    await expect(normalRow.getByText("精算", { exact: true })).toHaveCount(0);

    // 1人の間は精算不要と表示される
    await page.goto("/settlements");
    await expect(page.getByText("精算の必要はありません。")).toBeVisible();

    // 招待リンクを発行し、2人目（テストメンバー）が参加する
    await page.goto("/households");
    await card.getByRole("button", { name: /^管理（メンバー/ }).click();
    await card.getByLabel("参加できる人数").fill("2");
    await card.getByRole("button", { name: "招待リンクを発行" }).click();
    const linkInput = card
      .locator('input[readonly][value*="/invite/"]')
      .first();
    await expect(linkInput).toBeVisible();
    const inviteUrl = await linkInput.inputValue();

    // 第2ユーザーは共有セッションとは別の未認証コンテキストでログインする
    const memberContext = await browser.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
    });
    const memberPage = await memberContext.newPage();
    await memberPage.goto("/login");
    await memberPage.getByLabel("メールアドレス").fill(E2E_MEMBER_USER.email);
    await memberPage.getByLabel("パスワード").fill(E2E_MEMBER_USER.password);
    await memberPage.getByRole("button", { name: "ログイン" }).click();
    await expect(memberPage).toHaveURL(/\/households$/);
    await memberPage.goto(inviteUrl);
    await memberPage
      .getByRole("button", { name: "このグループに参加する" })
      .click();
    await expect(memberPage).toHaveURL(/\/dashboard$/);

    // 2人目が精算対象の支出（1000円）を登録
    await memberPage.goto("/transactions/new");
    await memberPage.getByLabel("金額").fill("1000");
    await memberPage
      .getByRole("checkbox", { name: /精算対象（割り勘）/ })
      .check();
    await memberPage.getByRole("button", { name: "登録する" }).click();
    await expect(memberPage).toHaveURL(/\/transactions$/);

    // オーナー側の精算ページ: 合計4000・1人あたり2000・テストメンバー→オーナー ¥1,000
    await page.goto("/settlements");
    await expect(page.getByText("¥4,000")).toBeVisible();
    await expect(page.getByText("¥2,000")).toBeVisible();
    const transfer = page.getByTestId("settlement-transfer");
    await expect(transfer).toContainText(E2E_MEMBER_USER.displayName);
    await expect(transfer).toContainText("¥1,000");

    // 精算を確定すると精算済みバッジが表示される
    await page.getByRole("button", { name: "精算済みにする" }).click();
    await page.getByRole("button", { name: "精算を確定する" }).click();
    await expect(page.getByText("精算済み", { exact: true })).toBeVisible();

    // 精算後に対象の支出を追加すると差異警告が表示される
    await page.goto("/transactions/new");
    await page.getByLabel("金額").fill("800");
    await page.getByRole("checkbox", { name: /精算対象（割り勘）/ }).check();
    await page.getByRole("button", { name: "登録する" }).click();
    await expect(page).toHaveURL(/\/transactions$/);
    await page.goto("/settlements");
    await expect(
      page.getByText(/現在の記帳内容と差異があります/),
    ).toBeVisible();

    // 実行者本人は取り消しでき、未精算の表示に戻る
    await page.getByRole("button", { name: "取り消す" }).click();
    await page.getByRole("button", { name: "精算を取り消す" }).click();
    await expect(
      page.getByRole("button", { name: "精算済みにする" }),
    ).toBeVisible();

    await memberContext.close();
  });
});
