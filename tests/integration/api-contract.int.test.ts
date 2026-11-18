import { afterAll, describe, expect, it } from "vitest";

import {
  AppointmentRowSchema,
  AppointmentWithPatientSchema,
  AuthTokenSchema,
  PatientRowSchema,
  PostgrestErrorSchema,
  UserRowSchema,
  assertMatches,
} from "../support/api-schemas";
import { deleteUser, makeAppointment, uniqueEmail } from "../support/factories";

// API contract: the JSON the backend API returns must match the schemas in tests/support/api-schemas.ts.
// The API-01…09 tests pin status codes; these pin the response BODY shape (columns, types, enums,
// formats), so a renamed column or a type change in supabase/schema.sql breaks the build here.

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const REST = `${URL_}/rest/v1`;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const asService = { apikey: SERVICE, authorization: `Bearer ${SERVICE}` };
const json = { "content-type": "application/json" };

const call = async (path: string, init: RequestInit = {}) => {
  const res = await fetch(`${REST}${path}`, { ...init, headers: { ...asService, ...init.headers } });
  const text = await res.text();
  return { status: res.status, contentType: res.headers.get("content-type"), body: text ? JSON.parse(text) : null };
};

const createdUserIds: string[] = [];
afterAll(async () => {
  for (const id of createdUserIds) await deleteUser(id); // cascades to patients and appointments
});

const booked = async () => {
  const data = await makeAppointment();
  createdUserIds.push(data.user.$id);
  return data;
};

describe("Supabase REST API response schemas (API contract)", () => {
  it("API-16 GET /users: 200, JSON array of rows that match the users schema", async () => {
    const { user } = await booked();
    const { status, contentType, body } = await call(`/users?id=eq.${user.$id}`);

    expect(status).toBe(200);
    expect(contentType).toMatch(/^application\/json/);
    expect(body).toHaveLength(1);
    const row = assertMatches(UserRowSchema, body[0], "users row");
    expect(row).toMatchObject({ id: user.$id, email: user.email });
  });

  it("API-17 GET /patients: the registered patient matches the patients schema", async () => {
    const { user, patient } = await booked();
    const { status, body } = await call(`/patients?userId=eq.${user.$id}`);

    expect(status).toBe(200);
    const row = assertMatches(PatientRowSchema, body[0], "patients row");
    expect(row).toMatchObject({ id: patient.$id, userId: user.$id, gender: "female", privacyConsent: true });
  });

  it("API-18 GET /appointments with the embedded patient (the admin dashboard's query) matches its schema", async () => {
    const { appointment, patient } = await booked();
    const { status, body } = await call(
      `/appointments?select=*,patient:patients!patientId(*)&id=eq.${appointment.$id}`
    );

    expect(status).toBe(200);
    const row = assertMatches(AppointmentWithPatientSchema, body[0], "appointment + patient");
    expect(row.patient.id).toBe(patient.$id);
    expect(row.status).toBe("pending");
    expect(new Date(row.schedule).toISOString()).toBe("2030-01-15T10:00:00.000Z");
  });

  it("API-19 every recent appointment (newest 50) matches the schema, not just the ones this test made", async () => {
    await booked();
    const { status, body } = await call("/appointments?select=*,patient:patients!patientId(*)&order=created_at.desc&limit=50");

    expect(status).toBe(200);
    expect(body.length).toBeGreaterThan(0);
    body.forEach((row: unknown, i: number) => assertMatches(AppointmentWithPatientSchema, row, `appointment #${i}`));
  });

  it("API-20 POST /users with return=representation: 201 and the created row matches the schema", async () => {
    const email = uniqueEmail("contract");
    const { status, body } = await call("/users", {
      method: "POST",
      headers: { ...json, prefer: "return=representation" },
      body: JSON.stringify({ name: "Contract Test", email, phone: "+15551234567" }),
    });

    expect(status).toBe(201);
    const row = assertMatches(UserRowSchema, body[0], "created user");
    createdUserIds.push(row.id);
    expect(row.email).toBe(email);
    expect(row.created_at).toBe(row.updated_at); // both default to now() in the same insert
  });

  it("API-21 PATCH /appointments (schedule it): 200, schema holds and updated_at moves forward", async () => {
    const { appointment } = await booked();
    const { status, body } = await call(`/appointments?id=eq.${appointment.$id}`, {
      method: "PATCH",
      headers: { ...json, prefer: "return=representation" },
      body: JSON.stringify({ status: "scheduled" }),
    });

    expect(status).toBe(200);
    const row = assertMatches(AppointmentRowSchema, body[0], "updated appointment");
    expect(row.status).toBe("scheduled");
    expect(Date.parse(row.updated_at)).toBeGreaterThan(Date.parse(row.created_at)); // set_updated_at trigger
  });

  it("API-22 every PostgREST error body (400, 404, 409) matches the error schema", async () => {
    const email = uniqueEmail("contract");
    const first = await call("/users", {
      method: "POST",
      headers: { ...json, prefer: "return=representation" },
      body: JSON.stringify({ name: "Dup", email, phone: "+15551234567" }),
    });
    createdUserIds.push(first.body[0].id);

    const errors = [
      await call("/users?id=eq.not-a-uuid"), // 400
      await call("/doctors"), // 404
      await call("/users", { method: "POST", headers: json, body: JSON.stringify({ name: "Dup", email, phone: "+15551234567" }) }), // 409
    ];
    expect(errors.map((e) => e.status)).toEqual([400, 404, 409]);
    errors.forEach((e) => assertMatches(PostgrestErrorSchema, e.body, `${e.status} error`));
  });

  it("API-23 POST /auth/v1/token: the admin sign-in response matches the token schema and carries the role", async () => {
    const res = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, ...json },
      body: JSON.stringify({ email: process.env.TEST_ADMIN_EMAIL, password: process.env.TEST_ADMIN_PASSWORD }),
    });

    expect(res.status).toBe(200);
    const token = assertMatches(AuthTokenSchema, await res.json(), "token response");
    expect(token.user.email).toBe(process.env.TEST_ADMIN_EMAIL);
    expect(token.user.app_metadata.role).toBe("admin");
  });

  it("API-24 control: the schemas really reject a broken contract (extra column, bad enum, wrong type)", async () => {
    const { appointment } = await booked();
    const { body } = await call(`/appointments?id=eq.${appointment.$id}`);
    const good = body[0];

    expect(AppointmentRowSchema.safeParse(good).success).toBe(true);
    expect(AppointmentRowSchema.safeParse({ ...good, doctorId: "x" }).success).toBe(false); // unknown column
    expect(AppointmentRowSchema.safeParse({ ...good, status: "done" }).success).toBe(false); // not in the enum
    expect(AppointmentRowSchema.safeParse({ ...good, schedule: 1_700_000_000 }).success).toBe(false); // not a timestamp
    const { reason: _dropped, ...missingReason } = good;
    expect(AppointmentRowSchema.safeParse(missingReason).success).toBe(false); // missing column
  });
});
