import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppointmentForm } from "@/components/forms/AppointmentForm";
import { createAppointmentAndContinue, updateAppointment } from "@/lib/actions/appointment.actions";

vi.mock("@/lib/actions/appointment.actions", () => ({
  createAppointmentAndContinue: vi.fn(),
  updateAppointment: vi.fn(),
}));

// On success the action redirects on the server (Next.js handles that), so there's no
// router.push() to check here; the redirect itself is covered by the integration tests.

const existing = {
  $id: "appt-1",
  primaryPhysician: "Ashok Seth",
  schedule: "2030-01-15T10:00:00.000Z",
  reason: "Back pain",
  note: "",
  cancellationReason: "",
  status: "pending",
} as any;

describe("AppointmentForm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the right button label per type", () => {
    const { rerender } = render(<AppointmentForm userId="u" patientId="p" type="create" />);
    expect(screen.getByRole("button", { name: "Submit Appointment" })).toBeInTheDocument();
    rerender(<AppointmentForm userId="u" patientId="p" type="schedule" appointment={existing} />);
    expect(screen.getByRole("button", { name: "Schedule Appointment" })).toBeInTheDocument();
    rerender(<AppointmentForm userId="u" patientId="p" type="cancel" appointment={existing} />);
    expect(screen.getByRole("button", { name: "Cancel Appointment" })).toBeInTheDocument();
  });

  it("VAL-09/VAL-11 create: requires doctor and reason", async () => {
    render(<AppointmentForm userId="u" patientId="p" type="create" />);
    await userEvent.click(screen.getByRole("button", { name: "Submit Appointment" }));

    expect(await screen.findByText("Select at least one doctor")).toBeInTheDocument();
    expect(screen.getByText("Reason must be at least 2 characters")).toBeInTheDocument();
    expect(createAppointmentAndContinue).not.toHaveBeenCalled();
  });

  it("BK-06 create without patientId shows an error and never calls updateAppointment", async () => {
    render(<AppointmentForm userId="u" patientId="" type="create" appointment={existing} />);
    await userEvent.click(screen.getByRole("button", { name: "Submit Appointment" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/complete registration first/i);
    expect(createAppointmentAndContinue).not.toHaveBeenCalled();
    expect(updateAppointment).not.toHaveBeenCalled();
  });

  it("BK-01 create: submits a pending appointment to the server action (which redirects to success)", async () => {
    vi.mocked(createAppointmentAndContinue).mockResolvedValue(undefined as never); // success = redirected, nothing returned
    render(<AppointmentForm userId="u1" patientId="p1" type="create" appointment={existing} />);
    await userEvent.click(screen.getByRole("button", { name: "Submit Appointment" }));

    await waitFor(() => expect(createAppointmentAndContinue).toHaveBeenCalledTimes(1));
    expect(vi.mocked(createAppointmentAndContinue).mock.calls[0][0]).toMatchObject({
      userId: "u1",
      patient: "p1",
      primaryPhysician: "Ashok Seth",
      reason: "Back pain",
      status: "pending",
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument(); // no error flashed while redirecting
  });

  it("VAL-16 shows a server error in the alert area and re-enables the button", async () => {
    vi.mocked(createAppointmentAndContinue).mockResolvedValue({ error: "Couldn't create the appointment." });
    render(<AppointmentForm userId="u" patientId="p" type="create" appointment={existing} />);
    await userEvent.click(screen.getByRole("button", { name: "Submit Appointment" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't create the appointment.");
    expect(screen.getByRole("button", { name: "Submit Appointment" })).toBeEnabled();
  });

  it("UI-08 schedule: pre-fills the doctor, sends status=scheduled and closes the modal", async () => {
    vi.mocked(updateAppointment).mockResolvedValue({ appointment: existing });
    const setOpen = vi.fn();
    render(
      <AppointmentForm userId="u" patientId="p" type="schedule" appointment={existing} setOpen={setOpen} />
    );
    expect(await screen.findByText("Dr. Ashok Seth")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Schedule Appointment" }));

    await waitFor(() => expect(setOpen).toHaveBeenCalledWith(false));
    expect(vi.mocked(updateAppointment).mock.calls[0][0]).toMatchObject({
      appointmentId: "appt-1",
      type: "schedule",
      appointment: { primaryPhysician: "Ashok Seth", status: "scheduled" },
    });
  });

  it("VAL-12 cancel: requires a cancellation reason", async () => {
    render(<AppointmentForm userId="u" patientId="p" type="cancel" appointment={existing} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancel Appointment" }));

    expect(await screen.findByText("Reason must be at least 2 characters")).toBeInTheDocument();
    expect(updateAppointment).not.toHaveBeenCalled();
  });

  it("BK-09 cancel: sends status=cancelled with the reason", async () => {
    vi.mocked(updateAppointment).mockResolvedValue({ appointment: existing });
    render(<AppointmentForm userId="u" patientId="p" type="cancel" appointment={existing} />);
    await userEvent.type(screen.getByPlaceholderText("Urgent meeting came up"), "Doctor on leave");
    await userEvent.click(screen.getByRole("button", { name: "Cancel Appointment" }));

    await waitFor(() => expect(updateAppointment).toHaveBeenCalledTimes(1));
    expect(vi.mocked(updateAppointment).mock.calls[0][0].appointment).toMatchObject({
      status: "cancelled",
      cancellationReason: "Doctor on leave",
    });
  });
});
