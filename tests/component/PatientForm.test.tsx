import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PatientForm } from "@/components/forms/PatientForm";
import { createUser } from "@/lib/actions/patient.actions";

// Server actions are mocked: component tests check the UI's behaviour, not the database
vi.mock("@/lib/actions/patient.actions", () => ({ createUser: vi.fn() }));

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

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
    expect(createUser).not.toHaveBeenCalled();
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

  it("BK-01 creates the user and goes to the register page", async () => {
    vi.mocked(createUser).mockResolvedValue({ $id: "user-123" });
    render(<PatientForm />);
    await fill("John Doe", "john@example.com", "5551234567"); // US default country -> +15551234567

    await waitFor(() =>
      expect(createUser).toHaveBeenCalledWith({
        name: "John Doe",
        email: "john@example.com",
        phone: "+15551234567",
      })
    );
    expect(push).toHaveBeenCalledWith("/patients/user-123/register");
  });

  it("UI-07 disables the button while the request is running", async () => {
    let resolve!: (v: unknown) => void;
    vi.mocked(createUser).mockReturnValue(new Promise((r) => (resolve = r)));
    render(<PatientForm />);
    await fill("John Doe", "john@example.com", "5551234567");

    const button = await screen.findByRole("button", { name: /loading/i });
    expect(button).toBeDisabled();

    resolve(undefined); // server returned nothing -> stays on the page, button enabled again
    await waitFor(() => expect(screen.getByRole("button", { name: "Get Started" })).toBeEnabled());
    expect(push).not.toHaveBeenCalled();
  });
});
