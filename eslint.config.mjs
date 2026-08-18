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
    // Supabase CLI-generated local dev artifacts (bundled function code, secrets cache).
    "supabase/**",
    // design-sync staging + generated bundle output (claude.ai/design converter).
    ".ds-sync/**",
    "ds-bundle/**",
    ".design-sync/**",
  ]),
]);

export default eslintConfig;
