import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Custom rules
  {
    rules: {
      // Warn on console statements (use logger instead)
      "no-console": ["warn", { allow: ["warn", "error", "debug", "info"] }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Test files can use console
    "tests/**",
    // Scripts use console.log for CLI output
    "scripts/**",
    // Sentry config files
    "sentry.*.config.ts",
  ]),
]);

export default eslintConfig;
