import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PatientForm } from "@/components/forms/PatientForm";
import { createUserAndContinue } from "@/lib/actions/patient.actions";

// Server actions are mocked: component tests check the UI's behaviour, not the database
vi.mock("@/lib/actions/patient.actions", () => ({ createUserAndContinue: vi.fn() }));

// On success the action redirects on the server (Next.js handles that), so there's no
// router.push() to check here; the redirect itself is covered by the integration tests.

const fill = async (name: string, email: string, phone: string) => {
  const user = userEvent.setup();
  if (name) await user.type(screen.getByPlaceholderText("John Doe"), name);
  if (email) await user.type(screen.getByPlaceholderText("johndoe@gmail.com"), email);
  if (phone) await user.type(screen.getByPlaceholderText("(555) 123-4567"), phone);
  await user.click(screen.getByRole("button", { name: "Get Started" }));
};

describe("PatientForm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("VAL-15 shows field errors and does not call the server when empty", async () => {
    render(<PatientForm />);
    await fill("", "", "");

    expect(await screen.findByText("Name must be at least 2 characters")).toBeInTheDocument();
    expect(screen.getByText("Invalid email address")).toBeInTheDocument();
    expect(screen.getByText("Invalid phone number")).toBeInTheDocument();
    expect(createUserAndContinue).not.toHaveBeenCalled();
  });

  it("VAL-15 clears an error once the field is fixed", async () => {
    render(<PatientForm />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Get Started" }));
    expect(await screen.findByText("Name must be at least 2 characters")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("John Doe"), "John Doe");
    await waitFor(() =>
      expect(screen.queryByText("Name must be at least 2 characters")).not.toBeInTheDocument()
    );
  });

  it("BK-01 sends the new user to the server action (which redirects to /register)", async () => {
    vi.mocked(createUserAndContinue).mockResolvedValue(undefined);
    render(<PatientForm />);
    await fill("John Doe", "john@example.com", "5551234567"); // US default country -> +15551234567

    await waitFor(() =>
      expect(createUserAndContinue).toHaveBeenCalledWith({
        name: "John Doe",
        email: "john@example.com",
        phone: "+15551234567",
      })
    );
  });

  it("UI-07 disables the button while the request is running", async () => {
    let resolve!: (v: undefined) => void;
    vi.mocked(createUserAndContinue).mockReturnValue(new Promise((r) => (resolve = r)));
    render(<PatientForm />);
    await fill("John Doe", "john@example.com", "5551234567");

    const button = await screen.findByRole("button", { name: /loading/i });
    expect(button).toBeDisabled();

    resolve(undefined); // returned instead of redirecting -> stays on the page, button enabled again
    await waitFor(() => expect(screen.getByRole("button", { name: "Get Started" })).toBeEnabled());
  });
});
