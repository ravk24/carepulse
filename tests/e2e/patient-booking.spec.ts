import { expect, test } from "@playwright/test";

import { bookAppointment, db, registerPatient, startAsPatient } from "./helpers";

test.describe("patient booking", () => {
  test("BK-01 @smoke new patient: Get Started -> Register -> Book -> Success", async ({ page }) => {
    const { userId } = await startAsPatient(page);
    await registerPatient(page);
    const appointmentId = await bookAppointment(page, "Naresh Trehan");

    await expect(page.getByRole("heading", { name: /successfully submitted/i })).toBeVisible();
    await expect(page.getByText("Dr. Naresh Trehan")).toBeVisible();

    // Saved as pending and linked to this user
    const { data } = await db().from("appointments").select("status, userId").eq("id", appointmentId).single();
    expect(data).toEqual({ status: "pending", userId });
  });

  test("BK-02 the same email reuses the existing user and skips registration", async ({ page }) => {
    const first = await startAsPatient(page);
    await registerPatient(page);

    await page.goto("/");
    await page.getByPlaceholder("John Doe").fill("Different Name");
    await page.getByPlaceholder("johndoe@gmail.com").fill(first.email);
    await page.getByPlaceholder("(555) 123-4567").fill("5550000000");
    await page.getByRole("button", { name: "Get Started" }).click();
    // Same user id as before, and since they're registered, /register forwards to booking (BK-03)
    await expect(page).toHaveURL(new RegExp(`/patients/${first.userId}/new-appointment$`));

    const { count } = await db().from("users").select("*", { count: "exact", head: true }).eq("email", first.email);
    expect(count).toBe(1);
  });

  test("BK-03 a registered patient opening /register is sent to booking", async ({ page }) => {
    const { userId } = await startAsPatient(page);
    await registerPatient(page);
    await page.goto(`/patients/${userId}/register`);
    await expect(page).toHaveURL(new RegExp(`/patients/${userId}/new-appointment$`));
  });

  test("BK-04 an unregistered user opening /new-appointment is sent to register", async ({ page }) => {
    const { userId } = await startAsPatient(page);
    await page.goto(`/patients/${userId}/new-appointment`);
    await expect(page).toHaveURL(new RegExp(`/patients/${userId}/register$`));
  });

  test("BK-07 success page with an unknown appointment id shows 'not found'", async ({ page }) => {
    const { userId } = await startAsPatient(page);
    await page.goto(`/patients/${userId}/new-appointment/success?appointmentId=00000000-0000-0000-0000-000000000000`);
    await expect(page.getByRole("heading", { name: "Appointment not found" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Request a new appointment" })).toBeVisible();
  });

  test("BK-15 booking dropdown lists all 12 doctors", async ({ page }) => {
    await startAsPatient(page);
    await registerPatient(page);
    await page.getByRole("combobox", { name: "Doctor" }).click();
    await expect(page.getByRole("option")).toHaveCount(12);
  });

  test("VAL-10 registration is blocked until all consents are ticked", async ({ page }) => {
    await startAsPatient(page);
    await page.getByRole("button", { name: "Submit and Continue" }).click();
    await expect(page.getByText("You must consent to privacy in order to proceed")).toBeVisible();
    await expect(page).toHaveURL(/\/register$/);
  });
});
