import { expect, test } from "@playwright/test";

// VIS: visual regression. Compares screenshots against baseline images saved in
// tests/e2e/visual.spec.ts-snapshots/ (committed). Any pixel change beyond the tolerance fails the
// test and the HTML report shows Expected / Actual / Diff side by side.
//
// Baselines are per OS (file names end in -win32.png / -linux.png) because fonts are rendered
// differently on each. Only Windows baselines are committed, so CI (Linux) skips @visual
// (see grepInvert in playwright.config.ts). UI-11 in theme.spec.ts is the cross-platform colour check.
//
//   Create / refresh baselines after an INTENDED design change:
//     npx playwright test visual --update-snapshots
//   Check:
//     npx playwright test visual

test.describe("visual baselines @visual", () => {
  test.use({ viewport: { width: 1440, height: 900 } }); // fixed size -> stable screenshots

  test("VIS-01 home page (patient form + side image)", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Get Started" })).toBeVisible();
    await page.evaluate(() => document.fonts.ready); // never compare before the web font is in
    await expect(page).toHaveScreenshot("home.png", {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.01, // tolerate anti-aliasing noise, not a real change
    });
  });

  test("VIS-02 admin sign-in modal", async ({ page }) => {
    await page.goto("/?admin=true");
    const dialog = page.getByRole("alertdialog", { name: /Admin Sign In/ });
    await expect(dialog.getByRole("button", { name: "Sign In" })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expect(dialog).toHaveScreenshot("admin-modal.png", {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.01,
    });
  });
});
