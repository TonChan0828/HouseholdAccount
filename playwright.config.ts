import { defineConfig, devices } from "@playwright/test";

import { STORAGE_STATE } from "./e2e/constants";

export default defineConfig({
  testDir: "./e2e",
  // *.test.ts は Vitest 用のユニットテスト（例: constants.test.ts）。Playwright では実行しない。
  testIgnore: /\.test\.ts$/,
  // 実行開始時に前回までの一時データ（接頭辞付きグループ）をクリーンアップする。
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    // ログイン状態を作る前処理
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    // 未認証で検証するテスト（認証ルーティングなど）
    {
      name: "chromium-guest",
      testMatch: /auth\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    // ログイン済みで検証するテスト（グループ管理など）
    {
      name: "chromium-auth",
      // プロジェクト単位の testIgnore はトップレベルを上書きするため .test.ts もここで除外する。
      testIgnore: [/auth\.(spec|setup)\.ts/, /\.test\.ts$/],
      use: {
        ...devices["Desktop Chrome"],
        storageState: STORAGE_STATE,
      },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
