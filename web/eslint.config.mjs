import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

/**
 * Minimal flat config — eslint v9.
 *
 * We intentionally do NOT chain through `next/core-web-vitals` via the
 * eslintrc compat shim: the Next.js 16 shareable config combined with the
 * compat layer triggers a circular-JSON crash in @eslint/eslintrc. Instead
 * we run the TypeScript rules ourselves; Next-specific rules are validated
 * by `pnpm build` (which fails on Next's own lint errors).
 */
export default [
  {
    ignores: ["node_modules", ".next", "dist", "next-env.d.ts", "**/*.config.{js,mjs,ts}"],
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
];
