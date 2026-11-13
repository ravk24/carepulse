import { type Page, expect, test } from "@playwright/test";

import { ADMIN_STATE, bookAppointment, db, registerPatient, signInThroughModal, startAsPatient } from "./helpers";

test.describe("signed out", () => {
  test("UI-01 @smoke /admin redirects to the sign-in modal", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/\?admin=true$/);
    await expect(page.getByRole("alertdialog", { name: /admin sign in/i })).toBeVisible();
  });

  test("UI-03 wrong password shows a generic error", async ({ page }) => {
    await signInThroughModal(page, process.env.TEST_ADMIN_EMAIL!, "definitely-wrong");
    await expect(page.getByText("Invalid email or password.")).toBeVisible();
    await expect(page).toHaveURL(/\?admin=true$/);
  });

  test("UI-03 a valid non-admin account is refused", async ({ page }) => {
    await signInThroughModal(page, process.env.TEST_USER_EMAIL!, process.env.TEST_USER_PASSWORD!);
    await expect(page.getByText("Invalid email or password.")).toBeVisible();
    await page.goto("/admin");
    await expect(page).toHaveURL(/\?admin=true$/);
  });

  test("UI-02 @smoke admin signs in and sees the dashboard with their email", async ({ page }) => {
    await signInThroughModal(page, process.env.TEST_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByText("Admin Dashboard")).toBeVisible();
    await expect(page.getByText(process.env.TEST_ADMIN_EMAIL!)).toBeVisible();
  });
});

test.describe("signed in", () => {
  // Reuse the cached session from auth.setup.ts: no login step per test
  test.use({ storageState: ADMIN_STATE });

  test("UI-05 a signed-in admin opening /?admin=true goes straight to /admin", async ({ page }) => {
    await page.goto("/?admin=true");
    await expect(page).toHaveURL(/\/admin$/);
  });

  // Creates a pending appointment for a brand-new patient and opens the dashboard
  async function pendingAppointmentOnDashboard(page: Page, browser: import("@playwright/test").Browser) {
    const patientContext = await browser.newContext(); // the patient is NOT signed in as admin
    const patientPage = await patientContext.newPage();
    const name = `E2E ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    await startAsPatient(patientPage, name);
    await registerPatient(patientPage);
    const appointmentId = await bookAppointment(patientPage, "Ashok Seth", "Knee pain");
    await patientContext.close();

    // Newest appointments are listed first, so this one is on page 1
    await page.goto("/admin");
    const row = page.getByRole("row").filter({ hasText: name });
    await expect(row).toBeVisible();
    return { row, appointmentId };
  }

  const count = (page: Page, label: string) =>
    page.locator(".stat-card", { hasText: label }).locator("h2").innerText().then(Number);

  test("BK-08 admin schedules a pending appointment", async ({ page, browser }) => {
    const { row, appointmentId } = await pendingAppointmentOnDashboard(page, browser);
    const scheduledBefore = await count(page, "Scheduled appointments");

    await row.getByRole("button", { name: "schedule" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: /schedule appointment/i })).toBeVisible();
    // UI-08 pre-filled. (Not getByText: Radix also renders a hidden native <select> with the same text)
    await expect(dialog.getByRole("combobox", { name: "Doctor" })).toHaveText(/Dr. Ashok Seth/);
    await dialog.getByRole("button", { name: "Schedule Appointment" }).click();
    await expect(dialog).toBeHidden();

    await expect(row.getByText("scheduled")).toBeVisible();
    await expect.poll(() => count(page, "Scheduled appointments")).toBe(scheduledBefore + 1);
    const { data } = await db().from("appointments").select("status").eq("id", appointmentId).single();
    expect(data?.status).toBe("scheduled");
  });

  test("BK-09 admin cancels with a reason", async ({ page, browser }) => {
    const { row, appointmentId } = await pendingAppointmentOnDashboard(page, browser);

    await row.getByRole("button", { name: "cancel" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder("Urgent meeting came up").fill("Doctor unavailable");
    await dialog.getByRole("button", { name: "Cancel Appointment" }).click();
    await expect(dialog).toBeHidden();

    await expect(row.getByText("cancelled")).toBeVisible();
    const { data } = await db()
      .from("appointments")
      .select("status, cancellationReason")
      .eq("id", appointmentId)
      .single();
    expect(data).toEqual({ status: "cancelled", cancellationReason: "Doctor unavailable" });
  });

  test("UI-04 sign out returns home and /admin is blocked again", async ({ page, browser }) => {
    // Uses its OWN admin account: Supabase signOut() defaults to scope "global", which revokes every
    // session of that user on the server, including the cached one the other tests share.
    const context = await browser.newContext({ storageState: undefined });
    const p = await context.newPage();
    await signInThroughModal(p, process.env.TEST_SIGNOUT_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!);
    await expect(p).toHaveURL(/\/admin$/);

    await p.getByRole("button", { name: "Sign out" }).click();
    await expect(p).toHaveURL(/\/$/);
    await p.goto("/admin");
    await expect(p).toHaveURL(/\?admin=true$/);
    await context.close();
  });
});
