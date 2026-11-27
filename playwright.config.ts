import { defineConfig, devices } from "@playwright/test";

import { STORAGE_STATE } from "./e2e/constants";

const E2E_PORT = Number(process.env.E2E_PORT ?? 3000);
const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;
const useProductionBuild = process.env.E2E_PRODUCTION_BUILD === "true";
const isCI = Boolean(process.env.CI);
const skipDatabaseSetup = process.env.E2E_SKIP_DB_SETUP === "true";

export default defineConfig({
  testDir: "./e2e",
  // *.test.ts は Vitest 用のユニットテスト（例: constants.test.ts）。Playwright では実行しない。
  testIgnore: /\.test\.ts$/,
  // 実行開始時に前回までの一時データ（接頭辞付きグループ）をクリーンアップする。
  globalSetup: skipDatabaseSetup ? undefined : "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  // 並列にする場合は seed と同じ E2E_WORKERS を指定する。ワーカーごとに別ユーザーを使う。
  workers: Number(process.env.E2E_WORKERS ?? 1),
  timeout: isCI ? 60_000 : 30_000,
  expect: {
    timeout: isCI ? 15_000 : 5_000,
  },
  reporter: "html",
  use: {
    baseURL: E2E_BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    // ログイン状態を作る前処理
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    // 未認証で検証するテスト（認証ルーティング・デモモードなど）
    {
      name: "chromium-guest",
      testMatch: /(accessibility|auth|demo)\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    // ログイン済みで検証するテスト（グループ管理など）
    {
      name: "chromium-auth",
      // プロジェクト単位の testIgnore はトップレベルを上書きするため .test.ts もここで除外する。
      testIgnore: [
        /accessibility\.spec\.ts/,
        /auth\.(spec|setup)\.ts/,
        /demo\.spec\.ts/,
        /\.test\.ts$/,
      ],
      use: {
        ...devices["Desktop Chrome"],
        storageState: STORAGE_STATE,
      },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: `npm run ${useProductionBuild ? "start" : "dev"} -- --port ${E2E_PORT}`,
    url: E2E_BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
