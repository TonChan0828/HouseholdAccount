import { expect, test } from "@playwright/test";

import { E2E_MEMBER_USER, MULTI_MEMBER_HOUSEHOLD } from "./constants";

// ログイン済み（storageState）で実行される。

test.describe("家計簿グループ管理", () => {
  test("同じグループがグループ選択画面に重複表示されない", async ({
    page,
  }) => {
    // 前提: E2E ユーザーは2人メンバーのグループ（MULTI_MEMBER_HOUSEHOLD）に所属している。
    const duplicateKeyErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && msg.text().includes("same key")) {
        duplicateKeyErrors.push(msg.text());
      }
    });

    await page.goto("/households");
    const titles = page.locator(
      '[data-testid="household-card"] [data-slot="card-title"] span.break-all',
    );
    await expect(titles.first()).toBeVisible();

    const names = await titles.allInnerTexts();
    expect(names.length).toBeGreaterThan(0);
    expect([...new Set(names)]).toEqual(names);
    expect(duplicateKeyErrors).toEqual([]);
  });

  test("複数メンバーのグループに切り替えできる", async ({ page }) => {
    // 別グループを作成してアクティブにし、切り替えボタンを表示させる
    const stamp = Date.now();
    await page.goto("/households");
    await page.getByLabel("グループ名").fill(`E2E切替元-${stamp}`);
    await page.getByRole("button", { name: "グループを作成" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // 2人メンバーのグループ（seed 済み）へ切り替えると利用中になる
    await page.goto("/households");
    const card = page
      .locator('[data-testid="household-card"]')
      .filter({ hasText: MULTI_MEMBER_HOUSEHOLD });
    await card
      .getByRole("button", { name: "このグループに切り替え" })
      .click();
    await expect(card.getByTestId("active-badge")).toHaveText("利用中");
  });

  test("グループを作成すると利用中になり、別グループへ切り替えできる", async ({
    page,
  }) => {
    const stamp = Date.now();
    const groupA = `E2EグループA-${stamp}`;
    const groupB = `E2EグループB-${stamp}`;

    const card = (name: string) =>
      page.locator('[data-testid="household-card"]').filter({ hasText: name });

    // グループ A を作成 → ダッシュボードへ遷移
    await page.goto("/households");
    await page.getByLabel("グループ名").fill(groupA);
    await page.getByRole("button", { name: "グループを作成" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // 作成直後は A がアクティブ
    await page.goto("/households");
    await expect(card(groupA)).toBeVisible();
    await expect(card(groupA).getByTestId("active-badge")).toHaveText("利用中");

    // グループ B を作成 → B がアクティブになる
    await page.getByLabel("グループ名").fill(groupB);
    await page.getByRole("button", { name: "グループを作成" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/households");
    await expect(card(groupB).getByTestId("active-badge")).toHaveText("利用中");

    // A に切り替え → A がアクティブに戻る
    await card(groupA)
      .getByRole("button", { name: "このグループに切り替え" })
      .click();
    await expect(card(groupA).getByTestId("active-badge")).toHaveText("利用中");
  });

  test("ヘッダーのスイッチャーから別グループへワンクリックで切り替えできる", async ({
    page,
  }) => {
    const stamp = Date.now();
    const groupA = `E2EスイッチャーA-${stamp}`;
    const groupB = `E2EスイッチャーB-${stamp}`;

    // A → B の順で作成（最後に作った B がアクティブになる）
    await page.goto("/households");
    await page.getByLabel("グループ名").fill(groupA);
    await page.getByRole("button", { name: "グループを作成" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/households");
    await page.getByLabel("グループ名").fill(groupB);
    await page.getByRole("button", { name: "グループを作成" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // ダッシュボード上のヘッダー・スイッチャーを開き、A に切り替える
    const switcher = page.getByRole("button", { name: /グループを切り替え/ });
    await expect(switcher).toContainText(groupB);
    await switcher.click();
    await page.getByRole("menuitem", { name: groupA }).click();

    // /households を経由せず、今いるページ（ダッシュボード）のまま表示が A に変わる
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(switcher).toContainText(groupA);
  });

  test("オーナーは招待リンクを発行でき、招待ページでグループ名が表示される", async ({
    page,
  }) => {
    const stamp = Date.now();
    const group = `E2E招待-${stamp}`;
    const card = page
      .locator('[data-testid="household-card"]')
      .filter({ hasText: group });

    // グループ作成（作成者はオーナー）
    await page.goto("/households");
    await page.getByLabel("グループ名").fill(group);
    await page.getByRole("button", { name: "グループを作成" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/households");

    // 人数上限 2 で招待リンクを発行
    await card.getByLabel("参加できる人数").fill("2");
    await card.getByRole("button", { name: "招待リンクを発行" }).click();

    // 発行されたリンクが表示される（/invite/<token> 形式）
    const linkInput = card
      .locator('input[readonly][value*="/invite/"]')
      .first();
    await expect(linkInput).toBeVisible();
    const url = await linkInput.inputValue();
    expect(url).toContain("/invite/");

    // 招待ページを開くとグループ名と参加ボタンが表示される
    const token = url.split("/invite/")[1];
    await page.goto(`/invite/${token}`);
    await expect(page.getByText(group, { exact: false })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "このグループに参加する" }),
    ).toBeVisible();
  });

  test("メンバー一覧に自分が表示され、単独オーナーには脱退ではなく委譲の案内が出る", async ({
    page,
  }) => {
    const stamp = Date.now();
    const group = `E2Eメンバー-${stamp}`;

    // グループ作成（作成者はオーナー＝唯一のメンバー）
    await page.goto("/households");
    await page.getByLabel("グループ名").fill(group);
    await page.getByRole("button", { name: "グループを作成" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/households");

    const card = page
      .locator('[data-testid="household-card"]')
      .filter({ hasText: group });

    // メンバー一覧に自分が「オーナー」「あなた」として表示される
    const memberItem = card.getByTestId("member-item").first();
    await expect(memberItem).toBeVisible();
    await expect(
      memberItem.getByText("オーナー", { exact: true }),
    ).toBeVisible();
    await expect(memberItem.getByText("あなた")).toBeVisible();

    // 単独オーナーは脱退ボタンが出ず、委譲を促す案内が出る（委譲必須）
    await expect(card.getByRole("button", { name: "脱退" })).toHaveCount(0);
    await expect(card.getByText(/委譲してから脱退/)).toBeVisible();
  });

  test("オーナーは複数メンバーのグループで他メンバーに委譲・除外操作を表示できる", async ({
    page,
  }) => {
    // 前提: E2E ユーザーは MULTI_MEMBER_HOUSEHOLD のオーナーで、
    // 2人目（E2E_MEMBER_USER）が member として参加している（seed 済み）。
    await page.goto("/households");
    const card = page
      .locator('[data-testid="household-card"]')
      .filter({ hasText: MULTI_MEMBER_HOUSEHOLD });

    // メンバーが2人以上表示される
    await expect(card.getByTestId("member-item")).toHaveCount(2);

    // 2人目（テストメンバー）の行に委譲・除外が出る（クリックはしない＝非破壊）
    const otherRow = card
      .getByTestId("member-item")
      .filter({ hasText: E2E_MEMBER_USER.displayName });
    await expect(
      otherRow.getByRole("button", { name: "オーナーを委譲" }),
    ).toBeVisible();
    await expect(otherRow.getByRole("button", { name: "除外" })).toBeVisible();
  });
});
