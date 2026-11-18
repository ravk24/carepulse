import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

import {
  AppointmentWithPatientSchema,
  AuthTokenSchema,
  PatientRowSchema,
  PostgrestErrorSchema,
  UserRowSchema,
  assertMatches,
} from "../support/api-schemas";

// API: REST testing with Playwright's `request` fixture (plain HTTP, no browser) plus schema validation.
// Creates a booking entirely through the Supabase REST API, checks every response against the schemas
// in tests/support/api-schemas.ts, then deletes it again. The Vitest API-16…24 tests do the same for
// the rows the app's server actions write.

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const REST = `${URL_}/rest/v1`;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const asService = { apikey: SERVICE, authorization: `Bearer ${SERVICE}`, prefer: "return=representation" };

test.describe("Supabase REST API with Playwright request + schema validation", () => {
  test("API-25 create user -> patient -> appointment, read it back joined, delete it: every body matches its schema", async ({
    request,
  }) => {
    const email = `pw-api-${randomUUID()}@example.com`;

    const userRes = await request.post(`${REST}/users`, {
      headers: asService,
      data: { name: "PW API", email, phone: "+15551234567" },
    });
    expect(userRes.status()).toBe(201);
    const user = assertMatches(UserRowSchema, (await userRes.json())[0], "created user");

    try {
      const patientRes = await request.post(`${REST}/patients`, {
        headers: asService,
        data: { userId: user.id, name: "PW API", email, phone: "+15551234567", gender: "other", privacyConsent: true },
      });
      expect(patientRes.status()).toBe(201);
      const patient = assertMatches(PatientRowSchema, (await patientRes.json())[0], "created patient");

      const apptRes = await request.post(`${REST}/appointments`, {
        headers: asService,
        data: {
          userId: user.id,
          patientId: patient.id,
          primaryPhysician: "Ashok Seth",
          schedule: "2030-02-01T09:30:00Z",
          reason: "Check-up",
        },
      });
      expect(apptRes.status()).toBe(201);

      const listRes = await request.get(`${REST}/appointments`, {
        headers: asService,
        params: { select: "*,patient:patients!patientId(*)", userId: `eq.${user.id}` },
      });
      expect(listRes.status()).toBe(200);
      expect(listRes.headers()["content-type"]).toMatch(/^application\/json/);
      const [row] = await listRes.json();
      const appointment = assertMatches(AppointmentWithPatientSchema, row, "appointment + patient");
      expect(appointment).toMatchObject({ status: "pending", note: null, cancellationReason: null }); // column defaults
      expect(appointment.patient.id).toBe(patient.id);
    } finally {
      const del = await request.delete(`${REST}/users`, { headers: asService, params: { id: `eq.${user.id}` } });
      expect(del.status()).toBe(200);
    }

    // Cascade: the patient and appointment went with the user
    const left = await request.get(`${REST}/patients`, { headers: asService, params: { userId: `eq.${user.id}` } });
    expect(await left.json()).toEqual([]);
  });

  test("API-26 admin sign-in (POST /auth/v1/token) matches the token schema", async ({ request }) => {
    const res = await request.post(`${URL_}/auth/v1/token?grant_type=password`, {
      headers: { apikey: ANON },
      data: { email: process.env.TEST_ADMIN_EMAIL, password: process.env.TEST_ADMIN_PASSWORD },
    });
    expect(res.status()).toBe(200);
    const token = assertMatches(AuthTokenSchema, await res.json(), "token response");
    expect(token.user.app_metadata.role).toBe("admin");
  });

  test("API-27 error and empty responses keep their shape: anon read = [], missing column = PostgREST error", async ({
    request,
  }) => {
    const anon = await request.get(`${REST}/appointments`, { headers: { apikey: ANON } });
    expect(anon.status()).toBe(200);
    expect(await anon.json()).toEqual([]); // RLS hides every row from the public key

    const bad = await request.get(`${REST}/appointments`, { headers: asService, params: { select: "doctorId" } });
    expect(bad.status()).toBe(400);
    const error = assertMatches(PostgrestErrorSchema, await bad.json(), "error body");
    expect(error.code).toBe("42703"); // undefined_column
  });
});
