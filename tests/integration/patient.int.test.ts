import { describe, expect, it } from "vitest";

import {
  createUser,
  createUserAndContinue,
  getPatient,
  getUser,
  registerPatientAndContinue,
} from "@/lib/actions/patient.actions";
import { getAppointment } from "@/lib/actions/appointment.actions";
import { SUPABASE_BUCKET, createSignedDocumentUrl, supabase } from "@/lib/supabase.config";
import { deleteUser, makeAppointment, makePatient, makeUser, uniqueEmail } from "../support/factories";

describe("patient actions (real local Supabase)", () => {
  it("createUser stores a user and returns the Appwrite-style document", async () => {
    const email = uniqueEmail();
    const user = await makeUser({ email });

    expect(user).toMatchObject({ email, name: "Test Patient", phone: "+15551234567" });
    expect(user.$id).toMatch(/^[0-9a-f-]{36}$/);
    expect(user.$createdAt).toBeTruthy();
    expect(await getUser(user.$id)).toMatchObject({ $id: user.$id, email });
  });

  it("BK-02 the same email returns the existing user instead of a duplicate", async () => {
    const email = uniqueEmail();
    const first = await makeUser({ email });
    const second = await createUser({ name: "Someone Else", email, phone: "+15550000000" });

    expect(second.$id).toBe(first.$id);
    const { count } = await supabase.from("users").select("*", { count: "exact", head: true }).eq("email", email);
    expect(count).toBe(1);
  });

  it("getPatient returns null for a user who hasn't registered yet (BK-04 redirect relies on this)", async () => {
    const user = await makeUser();
    expect(await getPatient(user.$id)).toBeNull();
  });

  it("registerPatient links the patient to the user", async () => {
    const user = await makeUser();
    const patient = await makePatient(user.$id);
    expect(patient).toMatchObject({ userId: user.$id, gender: "female", identificationDocumentId: null });
    expect((await getPatient(user.$id)).$id).toBe(patient.$id);
  });

  it("the database enforces one patient per user", async () => {
    const user = await makeUser();
    await makePatient(user.$id);
    // The action catches the unique-violation and returns undefined
    expect(await makePatient(user.$id)).toBeUndefined();
  });

  it("BK-13 ID upload goes to the PRIVATE bucket; only the path is stored; signed URL works", async () => {
    const user = await makeUser();
    const form = new FormData();
    form.append("blobFile", new Blob(["fake-png-bytes"], { type: "image/png" }));
    form.append("fileName", "id.png");

    const patient = await makePatient(user.$id, { identificationDocument: form });
    const path: string = patient.identificationDocumentId;
    expect(path).toMatch(new RegExp(`^${user.$id}/[0-9a-f-]{36}-id\\.png$`));

    // The bucket is private: no public URL access
    const { data: bucket } = await supabase.storage.getBucket(SUPABASE_BUCKET!);
    expect(bucket?.public).toBe(false);
    const publicUrl = supabase.storage.from(SUPABASE_BUCKET!).getPublicUrl(path).data.publicUrl;
    expect((await fetch(publicUrl)).ok).toBe(false);

    // ...but a server-created signed URL serves the file
    const signed = await createSignedDocumentUrl(path, 60);
    const res = await fetch(signed!);
    expect(res.ok).toBe(true);
    expect(await res.text()).toBe("fake-png-bytes");
  });

  it("BK-13 an expired signed URL no longer works", async () => {
    const user = await makeUser();
    const form = new FormData();
    form.append("blobFile", new Blob(["x"], { type: "image/png" }));
    form.append("fileName", "id.png");
    const patient = await makePatient(user.$id, { identificationDocument: form });

    const signed = await createSignedDocumentUrl(patient.identificationDocumentId, 1);
    await new Promise((r) => setTimeout(r, 2_100));
    expect((await fetch(signed!)).ok).toBe(false);
  });

  it("createSignedDocumentUrl returns null when there is no document", async () => {
    expect(await createSignedDocumentUrl(null)).toBeNull();
  });

  it("BK-14 deleting a user cascades to the patient and appointments", async () => {
    const { user, patient, appointment } = await makeAppointment();
    await deleteUser(user.$id);

    expect(await getPatient(user.$id)).toBeNull();
    expect(await getAppointment(appointment.$id)).toBeUndefined(); // .single() on 0 rows -> error -> undefined
    const { count } = await supabase.from("patients").select("*", { count: "exact", head: true }).eq("id", patient.$id);
    expect(count).toBe(0);
  });
});

// The forms call these wrappers. On success they redirect on the server instead of the client
// calling router.push(), which sometimes never finished. In tests, redirect() is mocked to throw
// "NEXT_REDIRECT:<url>" (tests/support/setup-integration.ts), the way the real one throws.
describe("server-side redirects after a successful action", () => {
  it("BK-01 createUserAndContinue saves the user and redirects to their registration page", async () => {
    const email = uniqueEmail();
    await expect(
      createUserAndContinue({ name: "Test Patient", email, phone: "+15551234567" })
    ).rejects.toThrow(/^NEXT_REDIRECT:\/patients\/[0-9a-f-]{36}\/register$/);

    const { data } = await supabase.from("users").select("id").eq("email", email).single();
    await expect(createUserAndContinue({ name: "Again", email, phone: "+15551234567" })).rejects.toThrow(
      `NEXT_REDIRECT:/patients/${data!.id}/register` // same email -> same user (BK-02)
    );
  });

  it("BK-01 registerPatientAndContinue saves the patient and redirects to booking", async () => {
    const user = await makeUser();
    const params = {
      userId: user.$id,
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
    } as RegisterUserParams;

    await expect(registerPatientAndContinue(params)).rejects.toThrow(
      `NEXT_REDIRECT:/patients/${user.$id}/new-appointment`
    );
    expect(await getPatient(user.$id)).toMatchObject({ userId: user.$id });

    // Failure (second patient for the same user) -> no redirect, returns undefined to the form
    expect(await registerPatientAndContinue(params)).toBeUndefined();
  });
});
