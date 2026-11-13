import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const root = import.meta.dirname;
const alias = {
  "@": root,
  // "server-only" throws when imported outside a React Server Components bundle.
  // Tests import server modules directly (no RSC bundler), so swap it for an empty module.
  "server-only": path.join(root, "tests/support/empty.ts"),
};

// Three projects, one config:
//   unit        -> pure functions / Zod schemas, Node environment (fastest)
//   component   -> React components in jsdom with React Testing Library
//   integration -> server actions against a real local Supabase (needs `npm run db:test:start`)
// `npm test` runs unit + component; `npm run test:integration` runs integration.
export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
          // lib/supabase.config.ts creates its client at import time and throws without a URL.
          // Creating a client makes no network call, so dummy values are enough for pure helpers.
          env: {
            NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
            SUPABASE_SERVICE_ROLE_KEY: "unit-test-dummy-key",
          },
        },
      },
      {
        extends: true,
        test: {
          name: "component",
          environment: "jsdom",
          include: ["tests/component/**/*.test.tsx"],
          setupFiles: ["tests/support/setup-dom.ts"],
          // Forms lazy-load react-datepicker / Radix Select (next/dynamic) inside the test, so the
          // very first run on a cold machine/CI runner can exceed the 5s default (seen once: 7.2s).
          testTimeout: 15_000,
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.int.test.ts"],
          setupFiles: ["tests/support/setup-integration.ts"],
          globalSetup: ["tests/support/global-setup-integration.ts"],
          // One shared database: run files one at a time so counts/cleanup don't race
          fileParallelism: false,
          testTimeout: 20_000,
          hookTimeout: 30_000,
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      include: ["lib/**/*.ts", "components/**/*.tsx", "constants/**/*.ts"],
      // shadcn/ui primitives are generated, third-party-style code
      exclude: ["components/ui/**"],
      // CI fails if coverage drops below these (measured with all three projects: ~95% lines).
      // Validation rules are the core business rules, so they must stay fully covered.
      thresholds: {
        lines: 90,
        statements: 90,
        functions: 90,
        branches: 80,
        "lib/validation.ts": { lines: 100, statements: 100, functions: 100, branches: 100 },
      },
    },
  },
});
