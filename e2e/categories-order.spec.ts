import { expect, test, type Page } from "@playwright/test";

import { ephemeralName } from "./constants";
import { createHousehold } from "./helpers";

async function createExpenseCategory(
  page: Page,
  name: string,
) {
  await page.goto("/categories/new");
  await page.getByLabel("カテゴリ名").fill(name);
  await page.getByRole("radio", { name: "支出" }).check();
  await page.getByRole("button", { name: "追加する" }).click();
  await expect(page).toHaveURL(/\/categories$/);
}

async function expectCategoryOptionsInOrder(
  page: Page,
  earlier: string,
  later: string,
) {
  const options = page.locator('input[type="radio"][name="category_id"]');
  await expect
    .poll(
      async () => {
        const labels = await options.evaluateAll((elements) =>
          elements.map((element) => element.parentElement?.textContent ?? ""),
        );
        const earlierIndex = labels.findIndex((label) => label.includes(earlier));
        const laterIndex = labels.findIndex((label) => label.includes(later));
        return earlierIndex >= 0 && laterIndex >= 0 && earlierIndex < laterIndex;
      },
      { message: `カテゴリ候補で「${earlier}」が「${later}」より前に表示される` },
    )
    .toBe(true);
}

async function expectCategoryRowsInOrder(
  page: Page,
  earlier: string,
  later: string,
) {
  const rows = page.getByTestId("category-row");
  await expect
    .poll(
      async () => {
        const texts = await rows.allTextContents();
        const earlierIndex = texts.findIndex((text) => text.includes(earlier));
        const laterIndex = texts.findIndex((text) => text.includes(later));
        return earlierIndex >= 0 && laterIndex >= 0 && earlierIndex < laterIndex;
      },
      { message: `カテゴリ一覧で「${earlier}」が「${later}」より前に表示される` },
    )
    .toBe(true);
}

test("種別内のカテゴリ順を保存し、収支と定期収支の候補にも反映する", async ({
  page,
}) => {
  const stamp = Date.now();
  const group = ephemeralName("カテゴリ順");
  const first = `順序A-${stamp}`;
  const second = `順序B-${stamp}`;

  await createHousehold(page, group);
  await createExpenseCategory(page, first);
  await createExpenseCategory(page, second);

  await page.goto("/categories");
  const firstRow = page
    .locator('[data-testid="category-row"]')
    .filter({ hasText: first });
  await firstRow.getByRole("button", { name: `${first}を下へ移動` }).click();
  // URLは変わらない Server Action のため、URL assertionではなくRSC更新後の順序を待つ。
  await expectCategoryRowsInOrder(page, second, first);
  await expect(page.getByTestId("category-move-up").first()).toBeDisabled();
  await expect(page.getByTestId("category-move-down").last()).toBeDisabled();

  await page.reload();
  await expectCategoryRowsInOrder(page, second, first);

  await page.goto("/transactions/new");
  await expectCategoryOptionsInOrder(page, second, first);

  await page.goto("/transactions/recurring/new");
  await expectCategoryOptionsInOrder(page, second, first);
});
