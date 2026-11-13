import { describe, expect, it } from "vitest";

import { Doctors, GenderOptions, PatientFormDefaultValues } from "@/constants";

describe("constants", () => {
  it("BK-15 has 12 doctors with unique names and no 'Dr.' prefix", () => {
    const names = Doctors.map((d) => d.name);
    expect(names).toHaveLength(12);
    expect(new Set(names).size).toBe(12);
    names.forEach((n) => expect(n).not.toMatch(/^dr\.?\s/i));
  });

  it("gender options match the database check constraint", () => {
    expect(GenderOptions).toEqual(["male", "female", "other"]);
  });

  it("consents start unticked", () => {
    expect(PatientFormDefaultValues.treatmentConsent).toBe(false);
    expect(PatientFormDefaultValues.disclosureConsent).toBe(false);
    expect(PatientFormDefaultValues.privacyConsent).toBe(false);
  });
});
