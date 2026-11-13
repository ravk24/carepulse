import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createAppointment,
  getAppointment,
  getRecentAppointmentList,
  updateAppointment,
} from "@/lib/actions/appointment.actions";
import { server, sentSms, twilioError21266 } from "../support/msw";
import { makeAppointment, makePatient, makeUser, signInAsAdmin } from "../support/factories";

const FAKE_TWILIO = {
  TWILIO_ACCOUNT_SID: `AC${"0".repeat(32)}`, // Twilio's client validates the "AC" prefix
  TWILIO_AUTH_TOKEN: "test-token",
  TWILIO_PHONE_NUMBER: "+15005550006",
};
const stubTwilio = () => Object.entries(FAKE_TWILIO).forEach(([k, v]) => vi.stubEnv(k, v));

const scheduleInput = (appointmentId: string, userId: string) => ({
  appointmentId,
  userId,
  timeZone: "UTC",
  type: "schedule",
  appointment: {
    primaryPhysician: "Atul Goel",
    schedule: new Date("2030-02-01T09:30:00Z"),
    status: "scheduled",
  } as any,
});

beforeEach(() => {
  sentSms.length = 0;
});

describe("createAppointment / getAppointment", () => {
  it("BK-05 creates a pending appointment linked to the right patient and user", async () => {
    const { user, patient, appointment } = await makeAppointment();

    expect(appointment).toMatchObject({
      status: "pending",
      userId: user.$id,
      patientId: patient.$id,
      primaryPhysician: "Ashok Seth",
      reason: "Back pain",
    });
    // The nested patient (join) is returned in the same document shape
    expect(appointment.patient).toMatchObject({ $id: patient.$id, name: "Test Patient" });

    const fetched = await getAppointment(appointment.$id);
    expect(fetched.$id).toBe(appointment.$id);
  });

  it("returns a friendly error (not a throw) when the patient doesn't exist", async () => {
    const user = await makeUser();
    const result = await createAppointment({
      userId: user.$id,
      patient: "00000000-0000-0000-0000-000000000000",
      primaryPhysician: "Ashok Seth",
      schedule: new Date(),
      reason: "x".repeat(5),
      status: "pending",
      note: undefined,
    });
    expect(result.appointment).toBeUndefined();
    expect(result.error).toMatch(/^Couldn't create the appointment/);
  });

  it("BK-07 getAppointment with an unknown id returns undefined (success page shows 'not found')", async () => {
    expect(await getAppointment("00000000-0000-0000-0000-000000000000")).toBeUndefined();
  });
});

describe("admin-only actions", () => {
  it("BK-10 updateAppointment is rejected without an admin session and changes nothing", async () => {
    const { user, appointment } = await makeAppointment();
    const result = await updateAppointment(scheduleInput(appointment.$id, user.$id));

    expect(result.error).toMatch(/Unauthorized/);
    expect((await getAppointment(appointment.$id)).status).toBe("pending");
  });

  it("BK-10 getRecentAppointmentList returns nothing without an admin session", async () => {
    expect(await getRecentAppointmentList()).toBeUndefined();
  });

  it("UI-03 a valid but non-admin user is refused and signed out", async () => {
    const { signInAdmin } = await import("@/lib/actions/auth.actions");
    const { cookieJar } = await import("../support/cookies");

    const result = await signInAdmin({
      email: process.env.TEST_USER_EMAIL!,
      password: process.env.TEST_USER_PASSWORD!,
    });
    expect(result.error).toBe("Invalid email or password.");
    expect([...cookieJar.keys()].some((k) => k.includes("auth-token"))).toBe(false);
  });

  it("UI-03 a wrong password gives the same generic message", async () => {
    const { signInAdmin } = await import("@/lib/actions/auth.actions");
    const result = await signInAdmin({ email: process.env.TEST_ADMIN_EMAIL!, password: "wrong" });
    expect(result.error).toBe("Invalid email or password.");
  });

  it("BK-08 admin schedules: status becomes scheduled, counts update, SMS is sent", async () => {
    stubTwilio();
    const { user, appointment } = await makeAppointment();
    expect(await signInAsAdmin()).toEqual({});

    const before = await getRecentAppointmentList();
    const result = await updateAppointment(scheduleInput(appointment.$id, user.$id));
    expect(result.appointment).toMatchObject({ status: "scheduled", primaryPhysician: "Atul Goel" });

    const after = await getRecentAppointmentList();
    expect(after.scheduledCount).toBe(before.scheduledCount + 1);
    expect(after.pendingCount).toBe(before.pendingCount - 1);
    expect(after.totalCount).toBe(after.documents.length);

    expect(sentSms).toHaveLength(1);
    expect(sentSms[0]).toMatchObject({ to: "+15551234567", from: FAKE_TWILIO.TWILIO_PHONE_NUMBER });
    expect(sentSms[0].body).toContain("confirmed for Feb 1, 2030, 9:30 AM with Dr. Atul Goel");
  });

  it("BK-09 admin cancels with a reason: status + reason saved, SMS sent", async () => {
    stubTwilio();
    const { user, appointment } = await makeAppointment();
    await signInAsAdmin();

    const result = await updateAppointment({
      appointmentId: appointment.$id,
      userId: user.$id,
      timeZone: "UTC",
      type: "cancel",
      appointment: {
        primaryPhysician: "Ashok Seth",
        schedule: new Date("2030-01-15T10:00:00Z"),
        status: "cancelled",
        cancellationReason: "Doctor on leave",
      } as any,
    });

    expect(result.appointment).toMatchObject({ status: "cancelled", cancellationReason: "Doctor on leave" });
    expect(sentSms[0].body).toContain("is cancelled. Reason:  Doctor on leave");
  });

  it("BK-11 with Twilio not configured, the update still succeeds and no SMS is attempted", async () => {
    for (const k of Object.keys(FAKE_TWILIO)) vi.stubEnv(k, "");
    const { user, appointment } = await makeAppointment();
    await signInAsAdmin();

    const result = await updateAppointment(scheduleInput(appointment.$id, user.$id));
    expect(result.appointment?.status).toBe("scheduled");
    expect(sentSms).toHaveLength(0);
  });

  it("BK-12 a Twilio error (21266) is logged but the update still succeeds", async () => {
    stubTwilio();
    server.use(twilioError21266);
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const { user, appointment } = await makeAppointment();
    await signInAsAdmin();

    const result = await updateAppointment(scheduleInput(appointment.$id, user.$id));
    expect(result.appointment?.status).toBe("scheduled");
    expect(result.error).toBeUndefined();
    expect(errorLog).toHaveBeenCalledWith(
      "An error occurred while sending sms:",
      expect.objectContaining({ code: 21266 })
    );
    errorLog.mockRestore();
  });

  it("updating an appointment that doesn't exist returns an error", async () => {
    await signInAsAdmin();
    const user = await makeUser();
    await makePatient(user.$id);
    const result = await updateAppointment(scheduleInput("00000000-0000-0000-0000-000000000000", user.$id));
    expect(result.error).toMatch(/^Couldn't update the appointment/);
  });
});
