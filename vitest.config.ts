import { resolve } from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      reportsDirectory: "./coverage",
      // Aggregate floors start just below the current baseline and prevent regressions.
      thresholds: {
        statements: 73,
        branches: 69,
        functions: 73,
        lines: 73,
      },
      include: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
      exclude: [
        "**/*.{test,spec}.{ts,tsx}",
        "**/*.d.ts",
        "app/**/layout.tsx",
        "app/**/page.tsx",
      ],
    },
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.{test,spec}.{ts,tsx}"],
    // Playwright のスペック/セットアップは Vitest 対象外。
    // e2e 配下のユニットテスト（*.test.ts、例: constants.test.ts）は Vitest で実行する。
    exclude: ["node_modules", ".next", "e2e/**/*.spec.ts", "e2e/**/*.setup.ts"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./"),
    },
  },
});
