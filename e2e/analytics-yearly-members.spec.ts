import { expect, test } from "@playwright/test";

import { ephemeralName } from "./constants";
import { createHousehold } from "./helpers";

test.describe("年間分析のメンバー別表示", () => {
  test("家計メンバーを選ぶとURLに反映され、年移動でも選択を維持する", async ({
    page,
  }) => {
    await createHousehold(page, ephemeralName("年間分析メンバー"));
    await page.goto("/analytics?view=year&year=2025");

    const memberSelect = page.getByLabel("メンバー");
    await expect(memberSelect).toBeVisible();
    const memberId = await memberSelect.locator("option").nth(1).getAttribute("value");
    expect(memberId).toBeTruthy();

    await memberSelect.selectOption(memberId!);
    await page.getByRole("button", { name: "表示" }).click();
    await expect(page).toHaveURL(
      `/analytics?view=year&year=2025&member=${memberId}`,
    );
    await expect(memberSelect).toHaveValue(memberId!);

    await page.getByRole("link", { name: "前の期間" }).click();
    await expect(page).toHaveURL(
      `/analytics?view=year&year=2024&member=${memberId}`,
    );
    await expect(page.getByLabel("メンバー")).toHaveValue(memberId!);
  });
});
