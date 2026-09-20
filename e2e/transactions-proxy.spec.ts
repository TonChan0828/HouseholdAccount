import { expect, test } from "@playwright/test";

import { E2E_MEMBER_USER, ephemeralName } from "./constants";
import { createHousehold, openTransactionDialog } from "./helpers";

// ログイン済み（storageState）で実行される。
// 収支の代理入力（spec 41）を「オーナーが名義人=テストメンバーで登録 →
// 名義人基準で集計 → 名義人自身が編集・削除できる」まで一気通貫で検証する。

test.describe("収支の代理入力（名義人）", () => {
  test("メンバーが1人のグループでは名義人を選ぶ欄を出さない", async ({
    page,
  }) => {
    await createHousehold(page, ephemeralName("代理単独グループ"));

    await page.goto("/transactions/new");
    await expect(page.getByLabel("金額")).toBeVisible();
    await expect(page.getByLabel("名義人")).toHaveCount(0);
  });

  test("代理入力した収支は名義人の記録として集計され、名義人も編集・削除できる", async ({
    page,
    browser,
    baseURL,
  }) => {
    test.slow();

    const stamp = Date.now();
    const group = ephemeralName("代理グループ");
    const memo = `代理ランチ-${stamp}`;
    const card = page
      .locator('[data-testid="household-card"]')
      .filter({ hasText: group });

    // オーナーがグループを作成し、招待リンクでテストメンバーを参加させる
    await createHousehold(page, group);

    await page.goto("/households");
    await card.getByRole("button", { name: /^管理（メンバー/ }).click();
    await card.getByLabel("参加できる人数").fill("2");
    await card.getByRole("button", { name: "招待リンクを発行" }).click();
    const linkInput = card
      .locator('input[readonly][value*="/invite/"]')
      .first();
    await expect(linkInput).toBeVisible();
    const inviteUrl = await linkInput.inputValue();

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

    // オーナーがテストメンバー名義で精算対象の支出を登録する
    await page.goto("/transactions/new");
    await page.getByLabel("名義人").selectOption({
      label: E2E_MEMBER_USER.displayName,
    });
    await page.getByLabel("金額").fill("2000");
    await page.getByRole("radio", { name: "食費" }).check();
    await page.getByLabel("メモ").fill(memo);
    await page.getByRole("checkbox", { name: /精算対象（割り勘）/ }).check();
    await page.getByRole("button", { name: "登録する" }).click();
    await expect(page).toHaveURL(/\/transactions$/);

    // 一覧に「名義人（入力者が代理）」のバッジが出る
    const row = page
      .locator('[data-testid="transaction-row"]')
      .filter({ hasText: memo });
    await expect(row.getByTestId("proxy-badge")).toContainText(
      E2E_MEMBER_USER.displayName,
    );
    await expect(row.getByTestId("proxy-badge")).toContainText("代理");

    // メンバー別アクティビティはテストメンバー側に集計される
    await page.goto("/members");
    const memberCard = page
      .getByTestId("member-card")
      .filter({ hasText: E2E_MEMBER_USER.displayName });
    await expect(memberCard.getByText("¥2,000")).toBeVisible();
    await expect(memberCard.getByText("1件")).toBeVisible();

    // 精算はテストメンバーが支払ったものとして扱われ、オーナー→テストメンバーの送金案になる
    await page.goto("/settlements");
    const transfer = page.getByTestId("settlement-transfer");
    await expect(transfer).toContainText(E2E_MEMBER_USER.displayName);
    await expect(transfer).toContainText("¥1,000");

    // メンバー絞り込み（名義人基準）で代理入力の行がヒットする
    await page.goto("/transactions");
    await page
      .getByLabel("メンバー（名義人）")
      .selectOption({ label: E2E_MEMBER_USER.displayName });
    await expect(page).toHaveURL(/member=/);
    await expect(
      page.locator('[data-testid="transaction-row"]').filter({ hasText: memo }),
    ).toBeVisible();

    // 名義人（テストメンバー）側でもモーダルから編集できる
    await memberPage.goto("/transactions");
    const memberRow = memberPage
      .locator('[data-testid="transaction-row"]')
      .filter({ hasText: memo });
    await expect(memberRow).toBeVisible();
    const dialog = await openTransactionDialog(
      memberPage,
      memberRow.getByRole("button", { name: "編集" }),
    );
    await dialog.getByLabel("金額").fill("3000");
    await dialog.getByRole("button", { name: "更新する" }).click();
    await expect(dialog).toBeHidden();
    await expect(memberRow).toContainText("¥3,000");

    // 名義人は削除もできる
    await memberRow.getByRole("button", { name: "削除" }).click();
    await expect(
      memberPage
        .locator('[data-testid="transaction-row"]')
        .filter({ hasText: memo }),
    ).toHaveCount(0);

    await memberContext.close();
  });
});
