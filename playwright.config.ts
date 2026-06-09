import { defineConfig, devices } from "@playwright/test";

import { STORAGE_STATE } from "./e2e/constants";

export default defineConfig({
  testDir: "./e2e",
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
      testIgnore: /auth\.(spec|setup)\.ts/,
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
