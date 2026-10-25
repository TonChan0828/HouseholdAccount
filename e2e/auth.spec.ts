import { expect, test } from "@playwright/test";

import { E2E_USER } from "./constants";

test.describe("認証ルーティング", () => {
  test("制御文字を含む移動先でログインしても外部へ誘導されない", async ({ page }) => {
    const external: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).hostname === "example.invalid") external.push(request.url());
    });
    await page.goto("/login?next=/%09/example.invalid");
    await page.getByLabel("メールアドレス").fill(E2E_USER.email);
    await page.getByLabel("パスワード").fill(E2E_USER.password);
    await page.getByRole("button", { name: "ログイン", exact: true }).click();
    await expect(page).toHaveURL(/\/households$/);
    expect(external).toEqual([]);
  });
  test("未認証でダッシュボードにアクセスするとログインへリダイレクトされる", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByLabel("メールアドレス")).toBeVisible();
  });

  test("未認証で /households にアクセスするとログインへリダイレクトされる", async ({
    page,
  }) => {
    await page.goto("/households");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("ログイン画面から新規登録画面へ遷移できる", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "新規登録" }).click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(
      page.getByRole("button", { name: "登録する" }),
    ).toBeVisible();
  });

  test("ログイン画面からパスワード再設定画面へ遷移できる", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "パスワードをお忘れですか？" }).click();
    await expect(page).toHaveURL(/\/forgot-password$/);
    await expect(
      page.getByRole("button", { name: "再設定メールを送信" }),
    ).toBeVisible();
  });

  test("未認証でも /forgot-password にアクセスできる", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page).toHaveURL(/\/forgot-password$/);
    await expect(page.getByLabel("メールアドレス")).toBeVisible();
  });

  test("未認証でも /reset-password にアクセスできる", async ({ page }) => {
    await page.goto("/reset-password");
    await expect(page).toHaveURL(/\/reset-password$/);
    await expect(page.getByLabel("新しいパスワード", { exact: true })).toBeVisible();
  });

  test("未認証でも /verify-email にアクセスでき、再送信ボタンが表示される", async ({
    page,
  }) => {
    await page.goto("/verify-email?email=new%40example.com");
    await expect(page).toHaveURL(/\/verify-email/);
    await expect(
      page.getByText("確認メールを送信しました", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "確認メールを再送信" }),
    ).toBeVisible();
  });

  test("未認証で / にアクセスするとランディングが表示される", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole("heading", { name: /家計を[\s\S]*みんなで一緒に。/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /無料で始める/ }).first(),
    ).toHaveAttribute("href", "/register");
  });

  test("未認証でも無効な招待リンクの案内へ到達できる", async ({ page }) => {
    await page.goto(`/invite/${"x".repeat(31)}`);
    await expect(page).toHaveURL(new RegExp(`/invite/${"x".repeat(31)}$`));
    await expect(page.getByText("この招待リンクは無効です。")).toBeVisible();
    await expect(page.getByRole("button", { name: "このグループに参加する" })).toHaveCount(0);
  });

  test("未認証の CSP report POST は受理し、GET は公開しない", async ({
    page,
    request,
  }) => {
    const report = await request.post("/api/csp-report", {
      headers: { "content-type": "application/csp-report" },
      data: {
        "csp-report": {
          "effective-directive": "production-e2e",
          "document-uri": "http://localhost/?secret=removed",
          "blocked-uri": "https://example.invalid/script.js?secret=removed",
        },
      },
    });
    expect(report.status()).toBe(204);

    await page.goto("/api/csp-report");
    await expect(page).toHaveURL(/\/login$/);
  });

  // ユーザーストーリー（01_auth）:
  //   登録済みユーザーとして、メール/パスワードでログインし家計簿に入れる。
  // （ログアウトは共有 E2E セッションを失効させ他テストを壊すため E2E では行わず、
  //   signOut の挙動は app/(auth)/actions.test.ts のユニットテストで担保する）
  test("メール/パスワードでログインするとグループ選択へ進む", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("メールアドレス").fill(E2E_USER.email);
    await page.getByLabel("パスワード").fill(E2E_USER.password);
    await page.getByRole("button", { name: "ログイン" }).click();
    await expect(page).toHaveURL(/\/households$/);
  });
});
