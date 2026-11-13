import { expect, test } from "@playwright/test";

import { startAsPatient } from "./helpers";

// Runs in both the desktop and the "mobile" (Pixel 7) projects
test("UI-13 no horizontal scroll and forms usable", async ({ page, isMobile }) => {
  for (const go of [() => page.goto("/"), () => startAsPatient(page)]) {
    await go();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
  }
  if (isMobile) {
    // The decorative side image is hidden on small screens
    await expect(page.locator("img.side-img")).toBeHidden();
  }
});
