import { defineConfig, devices } from "@playwright/test";

// Load the LOCAL Supabase settings. Never production.
process.loadEnvFile(".env.test");
if (!/127\.0\.0\.1|localhost/.test(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")) {
  throw new Error("E2E tests must run against a local Supabase (check .env.test)");
}

const PORT = 3100;
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI, // a stray test.only must not silently skip the suite in CI
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  // Default is 5s. A freshly started server handling 8 parallel workers once needed longer for
  // BK-02's submit -> router.push -> server redirect chain (1 flaky failure in ~15 runs, cold start only).
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "on-first-retry", // record a trace only when a test fails once -> cheap but debuggable
    screenshot: "only-on-failure",
  },
  projects: [
    // Signs the admin in once and saves the cookies (storageState) for the admin tests
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] }, // Chromium-based mobile emulation, 412x915
      dependencies: ["setup"],
      testMatch: /(responsive|smoke)\.spec\.ts/,
    },
  ],
  // Test the PRODUCTION build (what users get), not `next dev`
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npx next build && npx next start -p ${PORT}`,
        url: baseURL,
        timeout: 300_000,
        reuseExistingServer: !process.env.CI,
        // Every variable is passed explicitly. Next.js never overrides a variable that's already in
        // process.env, so this beats the production values in .env.local, including the empty Twilio ones.
        env: {
          NEXT_DIST_DIR: ".next-e2e",
          NEXT_TELEMETRY_DISABLED: "1",
          NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
          NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          SUPABASE_BUCKET: process.env.SUPABASE_BUCKET!,
          TWILIO_ACCOUNT_SID: "",
          TWILIO_AUTH_TOKEN: "",
          TWILIO_PHONE_NUMBER: "",
        },
      },
});
