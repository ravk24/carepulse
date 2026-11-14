import { expect, test } from "@playwright/test";

import { uniqueEmail } from "./helpers";

// FLK: a DELIBERATELY flaky test, kept as a teaching example (see test_practical_exercises.md §6).
//
// FLK-01 waits a FIXED time after clicking and then reads the URL ONCE. When the server is quick
// the redirect has finished and it passes; under load (8 parallel workers) it hasn't, and it fails.
// It's skipped unless FLAKY_DEMO=1, so it never breaks the normal suite:
//   FLAKY_DEMO=1 npx playwright test flaky-demo --repeat-each 50 --workers 8 --trace retain-on-failure
//
// FLK-02 is the same journey written correctly: a web-first assertion (toHaveURL) that retries until
// the redirect lands (or the timeout runs out), so speed differences no longer matter.

async function fillHomeForm(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByPlaceholder("John Doe").fill("Flaky Demo");
  await page.getByPlaceholder("johndoe@gmail.com").fill(uniqueEmail());
  await page.getByPlaceholder("(555) 123-4567").fill("+15551234567");
  await page.getByRole("button", { name: "Get Started" }).click();
}

test("FLK-01 (deliberately flaky) fixed sleep + one-shot URL check", async ({ page }) => {
  test.skip(!process.env.FLAKY_DEMO, "teaching example: run with FLAKY_DEMO=1");
  await fillHomeForm(page);
  await page.waitForTimeout(Number(process.env.FLAKY_DELAY_MS ?? 300)); // BAD: guesses how long the server needs
  expect(page.url()).toMatch(/\/patients\/[0-9a-f-]{36}\/register$/); // BAD: checked once, never retried
});

test("FLK-02 (fixed) web-first assertion waits for the redirect", async ({ page }) => {
  await fillHomeForm(page);
  await expect(page).toHaveURL(/\/patients\/[0-9a-f-]{36}\/register$/); // GOOD: retries until true
});
