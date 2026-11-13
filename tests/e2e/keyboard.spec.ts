import { type Locator, type Page, expect, test } from "@playwright/test";

import { uniqueEmail } from "./helpers";

// UI-15: the whole booking flow with the keyboard only. No mouse clicks and no locator.fill()
// or .focus(), because those skip the keyboard path. Every field has to be reached with Tab.

// Press Tab until `target` has focus. Failing here means the control can't be reached by keyboard.
async function tabTo(page: Page, target: Locator, maxPresses = 80) {
  for (let i = 0; i < maxPresses; i++) {
    if (await target.evaluate((el) => el === document.activeElement).catch(() => false)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error(`Could not reach ${target} with Tab in ${maxPresses} presses`);
}

// The pages are server-rendered, so Tab works on the plain HTML before React has hydrated, but
// arrow keys, Enter-to-submit and Space-on-checkbox need React's handlers. A fast test can press
// keys before they're attached (seen: ArrowRight on the gender radios did nothing in 2 of 10
// parallel runs). React adds an internal "__reactProps$..." key to each DOM element when it
// hydrates, so wait for that before using the keyboard on a new page.
async function waitForHydration(target: Locator) {
  await expect
    .poll(() => target.evaluate((el) => Object.keys(el).some((k) => k.startsWith("__reactProps$"))))
    .toBe(true);
}

async function typeInto(page: Page, target: Locator, text: string) {
  await tabTo(page, target);
  await page.keyboard.type(text);
}

// The phone input always shows a "+1" country prefix. Tabbing into a text field may select its
// whole value, and typing would then replace "+1" (seen once: "5557654321" became Brazil's
// "+55 57 65432 1" and registration failed validation). End moves the cursor after the prefix.
async function typePhone(page: Page, target: Locator, digits: string, expected: string) {
  await tabTo(page, target);
  await page.keyboard.press("End");
  await page.keyboard.type(digits);
  await expect(target).toHaveValue(expected);
}

// Radix Select: Enter opens it, the arrow keys move the highlight, Enter picks.
async function chooseWithKeyboard(page: Page, trigger: Locator, option: string) {
  await tabTo(page, trigger);
  await page.keyboard.press("Enter");
  const wanted = page.getByRole("option", { name: option });
  // Position of the highlighted option in the list (-1 = none yet)
  const highlightedIndex = () =>
    page.getByRole("option").evaluateAll((els) => els.findIndex((el) => el.hasAttribute("data-highlighted")));
  // Wait until the list is open and an option has keyboard focus, so key presses aren't lost
  await expect.poll(highlightedIndex).toBeGreaterThanOrEqual(0);
  for (let i = 0; i < 20 && (await wanted.getAttribute("data-highlighted")) === null; i++) {
    const before = await highlightedIndex();
    await page.keyboard.press("ArrowDown");
    // Under load React may not have re-rendered yet. Wait for the highlight to move before
    // checking again, otherwise the loop presses too often and skips past the option.
    await expect.poll(highlightedIndex).toBe(before + 1);
  }
  await expect(wanted).toHaveAttribute("data-highlighted", "");
  await page.keyboard.press("Enter");
  await expect(trigger).toContainText(option);
}

test("UI-15 keyboard-only booking: Get Started -> Register -> Book -> Success", async ({ page }) => {
  // Step 1: home page
  await page.goto("/");
  await waitForHydration(page.getByRole("button", { name: "Get Started" }));
  await typeInto(page, page.getByPlaceholder("John Doe"), "Keyboard Patient");
  await typeInto(page, page.getByPlaceholder("johndoe@gmail.com"), uniqueEmail());
  await typePhone(page, page.getByPlaceholder("(555) 123-4567"), "5551234567", "+1 555 123 4567");
  await page.keyboard.press("Enter"); // submit the form from the last field
  await expect(page).toHaveURL(/\/register$/);

  // Step 2: registration. Gender is a radio group, so the arrow keys change it.
  const male = page.getByRole("radio", { name: "male", exact: true });
  await waitForHydration(male);
  await tabTo(page, male);
  // Hold the key down like a person would. Radix moves focus on a short timer and only checks
  // the radio if the arrow key is still down when focus lands; press() releases it instantly,
  // which under load lost the selection (1 in ~30 runs).
  const female = page.getByRole("radio", { name: "female", exact: true });
  await page.keyboard.down("ArrowRight");
  await expect(female).toBeFocused();
  await page.keyboard.up("ArrowRight");
  await expect(female).toBeChecked();

  await typeInto(page, page.getByPlaceholder("14 street, New york, NY - 5101"), "221B Baker Street");
  await typeInto(page, page.getByPlaceholder("Software Engineer"), "Engineer");
  await typeInto(page, page.getByPlaceholder("Guardian's name"), "Jane Doe");
  await typePhone(page, page.getByPlaceholder("(555) 123-4567").nth(1), "5557654321", "+1 555 765 4321");
  await chooseWithKeyboard(
    page,
    page.getByRole("combobox", { name: "Primary care physician" }),
    "Dr. Devi Prasad Shetty"
  );
  await typeInto(page, page.getByPlaceholder("BlueCross BlueShield"), "BlueCross");
  await typeInto(page, page.getByPlaceholder("ABC123456789"), "ABC123");
  for (const consent of [/consent to receive treatment/i, /use and disclosure/i, /reviewed and agree/i]) {
    const box = page.getByRole("checkbox", { name: consent });
    await tabTo(page, box);
    await page.keyboard.press("Space");
    await expect(box).toBeChecked();
  }
  await tabTo(page, page.getByRole("button", { name: "Submit and Continue" }));
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/new-appointment$/);

  // Step 3: booking
  await waitForHydration(page.getByRole("button", { name: "Submit Appointment" }));
  await chooseWithKeyboard(page, page.getByRole("combobox", { name: "Doctor" }), "Dr. Naresh Trehan");
  await typeInto(page, page.getByPlaceholder("Annual montly check-up"), "Keyboard check-up");
  await tabTo(page, page.getByRole("button", { name: "Submit Appointment" }));
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/success\?appointmentId=/);
  await expect(page.getByRole("heading", { name: /successfully submitted/i })).toBeVisible();
  await expect(page.getByText("Dr. Naresh Trehan")).toBeVisible();
});
