import { describe, expect, it } from "vitest";

import {
  CancelAppointmentSchema,
  CreateAppointmentSchema,
  PatientFormValidation,
  ScheduleAppointmentSchema,
  UserFormValidation,
  getAppointmentSchema,
} from "@/lib/validation";

// Returns the first error message for a field, or undefined if the field is valid
const errorFor = (schema: any, data: object, field: string) => {
  const result = schema.safeParse(data);
  if (result.success) return undefined;
  return result.error.issues.find((i: any) => i.path[0] === field)?.message;
};

const validUser = { name: "John Doe", email: "john@example.com", phone: "+15551234567" };

const validPatient = {
  ...validUser,
  birthDate: new Date("1990-01-01"),
  gender: "male",
  address: "221B Baker Street",
  occupation: "Engineer",
  emergencyContactName: "Jane Doe",
  emergencyContactNumber: "+15557654321",
  primaryPhysician: "Naresh Trehan",
  insuranceProvider: "BlueCross",
  insurancePolicyNumber: "ABC123",
  treatmentConsent: true,
  disclosureConsent: true,
  privacyConsent: true,
};

const validAppointment = {
  primaryPhysician: "Naresh Trehan",
  schedule: new Date(),
  reason: "Annual check-up",
};

describe("UserFormValidation", () => {
  it("accepts a valid user", () => {
    expect(UserFormValidation.safeParse(validUser).success).toBe(true);
  });

  it.each([
    ["J", false],
    ["Jo", true],
    ["a".repeat(50), true],
    ["a".repeat(51), false],
  ])("VAL-01 name %j (length boundary) -> valid=%s", (name, ok) => {
    expect(errorFor(UserFormValidation, { ...validUser, name }, "name") === undefined).toBe(ok);
  });

  it.each([
    ["a@b.co", true],
    ["abc", false],
    ["", false],
  ])("VAL-02 email %j -> valid=%s", (email, ok) => {
    expect(errorFor(UserFormValidation, { ...validUser, email }, "email") === undefined).toBe(ok);
  });

  it.each([
    ["+15551234567", true],
    ["+123456789012345", true],
    ["5551234567", false],
    ["+123", false],
    ["+1234567890123456", false],
    ["+1555abc4567", false],
  ])("VAL-03 phone %j (E.164) -> valid=%s", (phone, ok) => {
    expect(errorFor(UserFormValidation, { ...validUser, phone }, "phone") === undefined).toBe(ok);
  });
});

describe("PatientFormValidation", () => {
  it("accepts a fully valid patient", () => {
    expect(PatientFormValidation.safeParse(validPatient).success).toBe(true);
  });

  it("VAL-04 birth date is required", () => {
    expect(errorFor(PatientFormValidation, { ...validPatient, birthDate: null }, "birthDate")).toBe(
      "Select your date of birth"
    );
  });

  it.each(["male", "female", "other"])("VAL-05 gender %j is accepted", (gender) => {
    expect(errorFor(PatientFormValidation, { ...validPatient, gender }, "gender")).toBeUndefined();
  });

  it("VAL-05 rejects an unknown gender", () => {
    expect(errorFor(PatientFormValidation, { ...validPatient, gender: "x" }, "gender")).toBeDefined();
  });

  it.each([
    ["a".repeat(4), false],
    ["a".repeat(5), true],
    ["a".repeat(500), true],
    ["a".repeat(501), false],
  ])("VAL-06 address length case %#", (address, ok) => {
    expect(errorFor(PatientFormValidation, { ...validPatient, address }, "address") === undefined).toBe(ok);
  });

  it.each([
    ["occupation", 500],
    ["emergencyContactName", 50],
    ["insuranceProvider", 50],
    ["insurancePolicyNumber", 50],
  ])("VAL-07 %s must be 2..%i characters", (field, max) => {
    const check = (value: string) =>
      errorFor(PatientFormValidation, { ...validPatient, [field]: value }, field) === undefined;
    expect(check("a")).toBe(false);
    expect(check("ab")).toBe(true);
    expect(check("a".repeat(max))).toBe(true);
    expect(check("a".repeat(max + 1))).toBe(false);
  });

  it("VAL-08 emergency contact number must be E.164", () => {
    const field = "emergencyContactNumber";
    expect(errorFor(PatientFormValidation, { ...validPatient, [field]: "5551234567" }, field)).toBe(
      "Invalid phone number"
    );
  });

  it("VAL-09 primary physician is required", () => {
    expect(
      errorFor(PatientFormValidation, { ...validPatient, primaryPhysician: "" }, "primaryPhysician")
    ).toBe("Select at least one doctor");
  });

  it.each([
    ["treatmentConsent", "You must consent to treatment in order to proceed"],
    ["disclosureConsent", "You must consent to disclosure in order to proceed"],
    ["privacyConsent", "You must consent to privacy in order to proceed"],
  ])("VAL-10 %s must be ticked", (field, message) => {
    expect(errorFor(PatientFormValidation, { ...validPatient, [field]: false }, field)).toBe(message);
  });

  it("optional medical fields can be omitted", () => {
    const { success } = PatientFormValidation.safeParse({ ...validPatient, allergies: undefined });
    expect(success).toBe(true);
  });
});

describe("Appointment schemas", () => {
  it("VAL-11 reason is required (2..500) on create", () => {
    expect(errorFor(CreateAppointmentSchema, { ...validAppointment, reason: "" }, "reason")).toBe(
      "Reason must be at least 2 characters"
    );
    expect(
      errorFor(CreateAppointmentSchema, { ...validAppointment, reason: "a".repeat(501) }, "reason")
    ).toBe("Reason must be at most 500 characters");
  });

  it("VAL-11 reason is optional on schedule and cancel", () => {
    const { reason: _reason, ...noReason } = validAppointment;
    expect(ScheduleAppointmentSchema.safeParse(noReason).success).toBe(true);
    expect(
      CancelAppointmentSchema.safeParse({ ...noReason, cancellationReason: "Doctor away" }).success
    ).toBe(true);
  });

  it("VAL-12 cancellation reason is required only on cancel", () => {
    expect(errorFor(CancelAppointmentSchema, validAppointment, "cancellationReason")).toBeDefined();
    expect(CreateAppointmentSchema.safeParse(validAppointment).success).toBe(true);
    expect(ScheduleAppointmentSchema.safeParse(validAppointment).success).toBe(true);
  });

  it("VAL-13 appointment date is required", () => {
    expect(
      errorFor(CreateAppointmentSchema, { ...validAppointment, schedule: null }, "schedule")
    ).toBe("Select a date and time");
  });

  it.each([
    ["create", CreateAppointmentSchema],
    ["schedule", ScheduleAppointmentSchema],
    ["cancel", CancelAppointmentSchema],
    ["anything-else", ScheduleAppointmentSchema],
  ])("VAL-14 getAppointmentSchema(%j)", (type, schema) => {
    expect(getAppointmentSchema(type)).toBe(schema);
  });
});
