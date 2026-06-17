import { resolve } from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
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
