import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminLoginModal } from "@/components/AdminLoginModal";
import { signInAdmin } from "@/lib/actions/auth.actions";

vi.mock("@/lib/actions/auth.actions", () => ({ signInAdmin: vi.fn() }));

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

const signIn = async () => {
  render(<AdminLoginModal />);
  await userEvent.type(screen.getByLabelText("Email"), "admin@example.com");
  await userEvent.type(screen.getByLabelText("Password"), "secret");
  await userEvent.click(screen.getByRole("button", { name: "Sign In" }));
};

describe("AdminLoginModal", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders an accessible dialog with labelled fields", () => {
    render(<AdminLoginModal />);
    expect(screen.getByRole("alertdialog", { name: /admin sign in/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  });

  it("UI-02 goes to /admin on success", async () => {
    vi.mocked(signInAdmin).mockResolvedValue({});
    await signIn();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin"));
    expect(signInAdmin).toHaveBeenCalledWith({ email: "admin@example.com", password: "secret" });
    expect(refresh).toHaveBeenCalled();
  });

  it("UI-03 shows the generic error from the server", async () => {
    vi.mocked(signInAdmin).mockResolvedValue({ error: "Invalid email or password." });
    await signIn();
    expect(await screen.findByText("Invalid email or password.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("shows a fallback error if the action throws", async () => {
    vi.mocked(signInAdmin).mockRejectedValue(new Error("network"));
    await signIn();
    expect(await screen.findByText("Something went wrong. Please try again.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign In" })).toBeEnabled();
  });

  it("close icon goes back home", async () => {
    render(<AdminLoginModal />);
    await userEvent.click(screen.getByAltText("close"));
    expect(push).toHaveBeenCalledWith("/");
  });
});
