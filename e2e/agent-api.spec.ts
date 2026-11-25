import { expect, test } from "@playwright/test";

test("設定でトークンを発行し、API を読み取って失効できる", async ({ page, request }) => {
  const label = `エージェント検証 ${Date.now()}`;
  await page.goto("/settings/agent");
  await page.getByLabel("トークンの名前").fill(label);
  await page.getByRole("button", { name: "発行", exact: true }).click();

  const field = page.getByRole("textbox", { name: "発行したトークン" });
  await expect(field).toHaveValue(/^ha_[0-9a-f]{64}$/);
  const token = await field.inputValue();
  const headers = { authorization: `Bearer ${token}` };

  const list = await request.get("/api/agent/groups", { headers });
  expect(list.status()).toBe(200);
  expect((await list.json()).length).toBeGreaterThan(0);

  await page.reload();
  await expect(field).toHaveCount(0);
  await page.getByRole("button", { name: `${label}を失効` }).click();
  await expect(page.getByText("トークンを失効しました。")).toBeVisible();

  const revoked = await request.get("/api/agent/groups", { headers });
  expect(revoked.status()).toBe(401);
  expect((await revoked.json()).error.code).toBe("invalid_token");
});
