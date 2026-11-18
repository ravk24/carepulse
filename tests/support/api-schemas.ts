import { z } from "zod";

// Response CONTRACTS of the backend API (Supabase PostgREST /rest/v1 and GoTrue /auth/v1).
// Strict objects: an extra, missing, renamed or retyped column fails the test, so a schema change in
// supabase/schema.sql that the app code doesn't know about is caught here instead of in production.
// Used by the Vitest API contract tests and by the Playwright `request` API tests.

const uuid = z.uuid();
// Postgres timestamptz as PostgREST serializes it, e.g. "2026-11-18T10:00:00.123456+00:00"
const timestamp = z.iso.datetime({ offset: true });
const optionalText = z.string().nullable();

export const UserRowSchema = z.strictObject({
  id: uuid,
  name: z.string().min(1),
  email: z.email(),
  phone: z.string().regex(/^\+\d{10,15}$/),
  created_at: timestamp,
  updated_at: timestamp,
});

export const PatientRowSchema = z.strictObject({
  id: uuid,
  userId: uuid,
  name: z.string().min(1),
  email: z.email(),
  phone: z.string(),
  birthDate: timestamp.nullable(),
  gender: z.enum(["male", "female", "other"]).nullable(),
  address: optionalText,
  occupation: optionalText,
  emergencyContactName: optionalText,
  emergencyContactNumber: optionalText,
  primaryPhysician: optionalText,
  insuranceProvider: optionalText,
  insurancePolicyNumber: optionalText,
  allergies: optionalText,
  currentMedication: optionalText,
  familyMedicalHistory: optionalText,
  pastMedicalHistory: optionalText,
  identificationType: optionalText,
  identificationNumber: optionalText,
  identificationDocumentId: optionalText,
  privacyConsent: z.boolean(),
  created_at: timestamp,
  updated_at: timestamp,
});

export const AppointmentRowSchema = z.strictObject({
  id: uuid,
  patientId: uuid,
  userId: uuid,
  schedule: timestamp,
  status: z.enum(["pending", "scheduled", "cancelled"]),
  primaryPhysician: z.string().min(1),
  reason: z.string().min(1),
  note: optionalText,
  cancellationReason: optionalText,
  created_at: timestamp,
  updated_at: timestamp,
});

// What the app selects for the admin table: "*, patient:patients!patientId(*)"
export const AppointmentWithPatientSchema = AppointmentRowSchema.extend({ patient: PatientRowSchema });

// PostgREST error body (4xx/5xx)
export const PostgrestErrorSchema = z.strictObject({
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.string().nullable(),
  hint: z.string().nullable(),
});

// GoTrue POST /auth/v1/token?grant_type=password (only the fields the app relies on; GoTrue adds more)
export const AuthTokenSchema = z.object({
  access_token: z.jwt(),
  token_type: z.literal("bearer"),
  expires_in: z.number().int().positive(),
  expires_at: z.number().int().positive(),
  refresh_token: z.string().min(1),
  user: z.object({
    id: uuid,
    email: z.email(),
    app_metadata: z.object({ role: z.string().optional() }).loose(),
  }),
});

// Throws with a readable list of the fields that broke the contract (works in Vitest and Playwright)
export function assertMatches<T extends z.ZodType>(schema: T, data: unknown, label = "response"): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(`${label} does not match its schema:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
