import { expect, test as setup } from "@playwright/test";

import { ADMIN_STATE, signInThroughModal } from "./helpers";

// Sign the admin in ONCE and cache the session cookies in a file.
// Admin tests then start already signed in (test.use({ storageState: ADMIN_STATE })),
// instead of every test typing the password again.
setup("sign in admin", async ({ page }) => {
  await signInThroughModal(page, process.env.TEST_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!);
  await expect(page).toHaveURL(/\/admin$/);
  await page.context().storageState({ path: ADMIN_STATE });
});
