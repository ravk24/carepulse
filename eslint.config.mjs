import { FlatCompat } from "@eslint/eslintrc";

// eslint-config-next 15 still ships the legacy (.eslintrc) format; FlatCompat adapts it.
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const eslintConfig = [
  {
    // `next lint` only looked at app/components/lib/...; `eslint .` sees everything, so skip
    // build output, generated files and test reports.
    ignores: [
      ".next/**",
      ".next-e2e/**",
      "out/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "blob-report/**",
      "next-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals"),
];

export default eslintConfig;
