import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    ignores: ["app/api/cron/recurring/route.ts", "lib/rate-limit.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          regex: "(?:^|/)supabase/admin(?:\\.[cm]?[jt]sx?)?$",
          message: "Use a session-scoped client. The admin client is reserved for recurring jobs and rate limiting.",
        }],
      }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "coverage/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
