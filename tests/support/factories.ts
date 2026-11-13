import { randomUUID } from "node:crypto";

import { signInAdmin } from "@/lib/actions/auth.actions";
import { createAppointment } from "@/lib/actions/appointment.actions";
import { createUser, registerPatient } from "@/lib/actions/patient.actions";
import { TABLES, supabase } from "@/lib/supabase.config";

// Unique per call, so tests never collide with each other or earlier runs
export const uniqueEmail = (tag = "int") => `${tag}-${randomUUID()}@example.com`;

export async function makeUser(overrides: Partial<CreateUserParams> = {}) {
  return createUser({
    name: "Test Patient",
    email: uniqueEmail(),
    phone: "+15551234567",
    ...overrides,
  });
}

export async function makePatient(userId: string, extra: Partial<RegisterUserParams> = {}) {
  return registerPatient({
    userId,
    name: "Test Patient",
    email: uniqueEmail(),
    phone: "+15551234567",
    birthDate: new Date("1990-01-01"),
    gender: "female",
    address: "221B Baker Street",
    occupation: "Engineer",
    emergencyContactName: "Jane Doe",
    emergencyContactNumber: "+15557654321",
    primaryPhysician: "Naresh Trehan",
    insuranceProvider: "BlueCross",
    insurancePolicyNumber: "ABC123",
    privacyConsent: true,
    ...extra,
  } as RegisterUserParams);
}

export async function makeAppointment() {
  const user = await makeUser();
  const patient = await makePatient(user.$id);
  const { appointment } = await createAppointment({
    userId: user.$id,
    patient: patient.$id,
    primaryPhysician: "Ashok Seth",
    schedule: new Date("2030-01-15T10:00:00Z"),
    reason: "Back pain",
    status: "pending",
    note: "Mornings please",
  });
  return { user, patient, appointment: appointment! };
}

export const signInAsAdmin = () =>
  signInAdmin({ email: process.env.TEST_ADMIN_EMAIL!, password: process.env.TEST_ADMIN_PASSWORD! });

export const deleteUser = (id: string) => supabase.from(TABLES.users).delete().eq("id", id);
