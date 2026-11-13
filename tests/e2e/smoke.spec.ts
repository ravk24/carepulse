import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { registerPatient, startAsPatient } from "./helpers";

test.describe("site-wide checks", () => {
  test("UI-06 / UI-12 logo links home and footer is correct on every patient page", async ({ page }) => {
    const { userId } = await startAsPatient(page);
    const pages = [
      `/patients/${userId}/register`,
      `/patients/${userId}/new-appointment/success?appointmentId=00000000-0000-0000-0000-000000000000`,
    ];
    for (const path of ["/", ...pages]) {
      await page.goto(path);
      await expect(page.getByText("© 2025 CarePulse")).toBeVisible();
      await expect(page.getByText(/CarePluse/)).toHaveCount(0); // old typo
      await expect(page.getByRole("link", { name: "CarePulse home" })).toHaveAttribute("href", "/");
    }
    await page.getByRole("link", { name: "CarePulse home" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("UI-14 home, register and booking pages have no serious accessibility violations", async ({ page }) => {
    const check = async () => {
      const results = await new AxeBuilder({ page }).analyze();
      const serious = results.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""));
      expect(serious.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    };
    await page.goto("/");
    await check();
    await startAsPatient(page);
    await check();
    await registerPatient(page);
    await check();
  });
});
