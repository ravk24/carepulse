import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AdminLoginGate } from "@/components/AdminLoginGate";
import { AppointmentModal } from "@/components/AppointmentModal";
import { DataTable } from "@/components/table/DataTable";
import { columns } from "@/components/table/columns";

vi.mock("@/lib/actions/appointment.actions", () => ({
  createAppointment: vi.fn(),
  updateAppointment: vi.fn(),
}));
vi.mock("@/lib/actions/auth.actions", () => ({ signInAdmin: vi.fn() }));

let search = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => search,
}));

const appointment = {
  $id: "appt-1",
  userId: "user-1",
  primaryPhysician: "Ashok Seth",
  schedule: "2030-01-15T10:00:00.000Z",
  reason: "Back pain",
  status: "pending",
  patient: { $id: "patient-1", name: "Priya Sharma" },
} as any;

describe("AdminLoginGate", () => {
  it("renders nothing without ?admin=true", () => {
    search = new URLSearchParams();
    const { container } = render(<AdminLoginGate />);
    expect(container).toBeEmptyDOMElement();
  });

  it("UI-01 lazy-loads the sign-in modal with ?admin=true", async () => {
    search = new URLSearchParams("admin=true");
    render(<AdminLoginGate />);
    expect(await screen.findByRole("alertdialog", { name: /admin sign in/i })).toBeInTheDocument();
  });
});

describe("AppointmentModal", () => {
  it.each([
    ["schedule", "Schedule Appointment"],
    ["cancel", "Cancel Appointment"],
  ] as const)("UI-08 %s opens with the right title", async (type, title) => {
    render(<AppointmentModal type={type} userId="u" patientId="p" appointment={appointment} title="" description="" />);
    await userEvent.click(screen.getByRole("button", { name: type }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: new RegExp(title, "i") })).toBeInTheDocument();
  });
});

describe("admin table columns", () => {
  it("renders a row with patient, status, doctor and both actions", () => {
    render(<DataTable columns={columns} data={[appointment]} />);
    const row = screen.getAllByRole("row")[1];
    expect(within(row).getByText("1")).toBeInTheDocument();
    expect(within(row).getByText("Priya Sharma")).toBeInTheDocument();
    expect(within(row).getByText("pending")).toBeInTheDocument();
    expect(within(row).getByText("Dr. Ashok Seth")).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "schedule" })).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "cancel" })).toBeInTheDocument();
  });
});
