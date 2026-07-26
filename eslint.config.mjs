import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // E2E helper scripts are throwaway integration checks against the live Click/Payme
    // sandboxes — they use top-level await and bare expressions deliberately, which the
    // TS/next rules flag. They are not part of the app build.
    "scripts/e2e/**",
  ]),
]);

export default eslintConfig;
