import { randomUUID } from "node:crypto";

import { type Page, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Where the signed-in admin's cookies are cached between projects (git-ignored)
export const ADMIN_STATE = "tests/e2e/.auth/admin.json";

export const uniqueEmail = () => `e2e-${randomUUID()}@example.com`;

// Direct DB access for arranging data / checking results (local Supabase only)
export const db = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

// Step 1 of the patient flow: the home page form
export async function startAsPatient(page: Page, name = "E2E Patient", email = uniqueEmail()) {
  await page.goto("/");
  await page.getByPlaceholder("John Doe").fill(name);
  await page.getByPlaceholder("johndoe@gmail.com").fill(email);
  await page.getByPlaceholder("(555) 123-4567").fill("5551234567");
  await page.getByRole("button", { name: "Get Started" }).click();
  await expect(page).toHaveURL(/\/patients\/[0-9a-f-]{36}\/register$/);
  const userId = page.url().split("/patients/")[1].split("/")[0];
  return { userId, email };
}

// Step 2: the registration form, with only the required fields
export async function registerPatient(page: Page, doctor = "Devi Prasad Shetty") {
  await page.getByPlaceholder("14 street, New york, NY - 5101").fill("221B Baker Street");
  await page.getByPlaceholder("Software Engineer").fill("Engineer");
  await page.getByPlaceholder("Guardian's name").fill("Jane Doe");
  await page.getByPlaceholder("(555) 123-4567").nth(1).fill("5557654321");
  await page.getByRole("combobox", { name: "Primary care physician" }).click();
  await page.getByRole("option", { name: `Dr. ${doctor}` }).click();
  await page.getByPlaceholder("BlueCross BlueShield").fill("BlueCross");
  await page.getByPlaceholder("ABC123456789").fill("ABC123");
  await page.getByLabel(/consent to receive treatment/i).click();
  await page.getByLabel(/use and disclosure/i).click();
  await page.getByLabel(/reviewed and agree/i).click();
  await page.getByRole("button", { name: "Submit and Continue" }).click();
  await expect(page).toHaveURL(/\/new-appointment$/);
}

// Step 3: book an appointment
export async function bookAppointment(page: Page, doctor = "Naresh Trehan", reason = "Annual check-up") {
  await page.getByRole("combobox", { name: "Doctor" }).click();
  await page.getByRole("option", { name: `Dr. ${doctor}` }).click();
  await page.getByPlaceholder("Annual montly check-up").fill(reason);
  await page.getByRole("button", { name: "Submit Appointment" }).click();
  await expect(page).toHaveURL(/\/success\?appointmentId=/);
  return new URL(page.url()).searchParams.get("appointmentId")!;
}

// Admin sign-in through the modal. Scoped to the dialog: the home page behind it also has an
// "Email" field, and Playwright's strict mode refuses to act on an ambiguous locator.
export async function signInThroughModal(page: Page, email: string, password: string) {
  await page.goto("/?admin=true");
  const dialog = page.getByRole("alertdialog", { name: /admin sign in/i });
  await dialog.getByLabel("Email").fill(email);
  await dialog.getByLabel("Password").fill(password);
  await dialog.getByRole("button", { name: "Sign In" }).click();
}
