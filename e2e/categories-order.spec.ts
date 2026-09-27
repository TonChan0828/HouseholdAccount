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
  const earlierIndex = await page
    .getByRole("radio", { name: earlier })
    .evaluate((element) =>
      Array.from(document.querySelectorAll('input[type="radio"][name="category_id"]')).indexOf(
        element as HTMLInputElement,
      ),
    );
  const laterIndex = await page
    .getByRole("radio", { name: later })
    .evaluate((element) =>
      Array.from(document.querySelectorAll('input[type="radio"][name="category_id"]')).indexOf(
        element as HTMLInputElement,
      ),
    );

  expect(await options.count()).toBeGreaterThan(0);
  expect(earlierIndex).toBeGreaterThanOrEqual(0);
  expect(laterIndex).toBeGreaterThanOrEqual(0);
  expect(earlierIndex).toBeLessThan(laterIndex);
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
  await expect(page).toHaveURL(/\/categories$/);

  const rows = await page.getByTestId("category-row").allTextContents();
  expect(rows.findIndex((text) => text.includes(second))).toBeLessThan(
    rows.findIndex((text) => text.includes(first)),
  );
  await expect(page.getByTestId("category-move-up").first()).toBeDisabled();
  await expect(page.getByTestId("category-move-down").last()).toBeDisabled();

  await page.reload();
  const reloadedRows = await page.getByTestId("category-row").allTextContents();
  expect(reloadedRows.findIndex((text) => text.includes(second))).toBeLessThan(
    reloadedRows.findIndex((text) => text.includes(first)),
  );

  await page.goto("/transactions/new");
  await expectCategoryOptionsInOrder(page, second, first);

  await page.goto("/transactions/recurring/new");
  await expectCategoryOptionsInOrder(page, second, first);
});
