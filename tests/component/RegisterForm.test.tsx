import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import RegisterForm from "@/components/forms/RegisterForm";
import { registerPatientAndContinue } from "@/lib/actions/patient.actions";

vi.mock("@/lib/actions/patient.actions", () => ({ registerPatientAndContinue: vi.fn() }));

// On success the action redirects on the server (Next.js handles that), so there's no
// router.push() to check here; the redirect itself is covered by the integration tests.

const user = { $id: "user-1", name: "John Doe", email: "john@example.com", phone: "+15551234567" };

// Fills every required field. Radix Select needs real pointer events -> userEvent, not fireEvent.
async function fillRequired(u = userEvent.setup()) {
  await u.type(screen.getByPlaceholderText("14 street, New york, NY - 5101"), "221B Baker Street");
  await u.type(screen.getByPlaceholderText("Software Engineer"), "Engineer");
  await u.type(screen.getByPlaceholderText("Guardian's name"), "Jane Doe");
  // two phone inputs share a placeholder: [0] patient (prefilled), [1] emergency contact
  await u.type(screen.getAllByPlaceholderText("(555) 123-4567")[1], "5557654321");
  await u.type(screen.getByPlaceholderText("BlueCross BlueShield"), "BlueCross");
  await u.type(screen.getByPlaceholderText("ABC123456789"), "ABC123");

  await u.click(await screen.findByRole("combobox", { name: /primary care physician/i }));
  await u.click(within(await screen.findByRole("listbox")).getByText("Dr. Atul Goel"));
  return u;
}

describe("RegisterForm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("pre-fills name, email and phone from the user", () => {
    render(<RegisterForm user={user} />);
    expect(screen.getByPlaceholderText("John Doe")).toHaveValue("John Doe");
    expect(screen.getByPlaceholderText("johndoe@gmail.com")).toHaveValue("john@example.com");
  });

  it("VAL-09/VAL-10 shows required-field and consent errors on an empty submit", async () => {
    render(<RegisterForm user={user} />);
    await userEvent.click(screen.getByRole("button", { name: /submit and continue/i }));

    expect(await screen.findByText("Select at least one doctor")).toBeInTheDocument();
    expect(screen.getByText("Address must be at least 5 characters")).toBeInTheDocument();
    expect(screen.getByText("You must consent to treatment in order to proceed")).toBeInTheDocument();
    expect(screen.getByText("You must consent to disclosure in order to proceed")).toBeInTheDocument();
    expect(screen.getByText("You must consent to privacy in order to proceed")).toBeInTheDocument();
    expect(registerPatientAndContinue).not.toHaveBeenCalled();
  });

  it("VAL-10 one unticked consent still blocks submit", async () => {
    render(<RegisterForm user={user} />);
    const u = await fillRequired();
    await u.click(screen.getByLabelText(/consent to receive treatment/i));
    await u.click(screen.getByLabelText(/use and disclosure/i));
    // privacy consent left unticked
    await u.click(screen.getByRole("button", { name: /submit and continue/i }));

    expect(await screen.findByText("You must consent to privacy in order to proceed")).toBeInTheDocument();
    expect(registerPatientAndContinue).not.toHaveBeenCalled();
  });

  it("BK-01 submits a valid patient (with ID upload) to the server action (which redirects to booking)", async () => {
    URL.createObjectURL = vi.fn(() => "blob:preview");
    vi.mocked(registerPatientAndContinue).mockResolvedValue(undefined);
    const { container } = render(<RegisterForm user={user} />);
    const u = await fillRequired();

    await u.click(screen.getByLabelText("female"));
    const file = new File(["fake"], "id.png", { type: "image/png" });
    await u.upload(container.querySelector("input[type=file]") as HTMLInputElement, file);

    await u.click(screen.getByLabelText(/consent to receive treatment/i));
    await u.click(screen.getByLabelText(/use and disclosure/i));
    await u.click(screen.getByLabelText(/reviewed and agree/i));
    await u.click(screen.getByRole("button", { name: /submit and continue/i }));

    await waitFor(() => expect(registerPatientAndContinue).toHaveBeenCalledTimes(1));
    const sent = vi.mocked(registerPatientAndContinue).mock.calls[0][0];
    expect(sent).toMatchObject({
      userId: "user-1",
      gender: "female",
      primaryPhysician: "Atul Goel",
      emergencyContactNumber: "+15557654321",
      privacyConsent: true,
    });
    // The file travels as FormData (server actions can't receive File objects inside plain objects)
    expect(sent.identificationDocument).toBeInstanceOf(FormData);
    expect(sent.identificationDocument!.get("fileName")).toBe("id.png");
  });
});
