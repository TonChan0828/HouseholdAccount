import { expect, test } from "@playwright/test";

// ユーザーストーリー（19_help）:
//   初見のユーザーとして、ヘルプページで各画面の操作手順を
//   アコーディオンで開いて確認できる。

test.describe("ヘルプ", () => {
  test("ヘルプを開き、操作ガイドのアコーディオンを展開できる", async ({
    page,
  }) => {
    await page.goto("/help");
    await expect(
      page.getByRole("heading", { name: "ヘルプ" }),
    ).toBeVisible();

    // 「収支の記録」セクションは初期状態では折りたたまれている
    const trigger = page.getByRole("button", { name: /収支の記録/ });
    await expect(trigger).toBeVisible();
    const description = page.getByText(
      "収入・支出の追加、編集、削除、期間の切り替え",
    );
    await expect(description).toBeHidden();

    // クリックで展開すると操作手順の本文が表示される
    await trigger.click();
    await expect(description).toBeVisible();
  });
});
