// Shape returned by the server actions (see toDocument in lib/supabase.config.ts).
export interface BaseDocument {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
}

export interface Patient extends BaseDocument {
  userId: string;
  name: string;
  email: string;
  phone: string;
  birthDate: Date;
  gender: Gender;
  address: string;
  occupation: string;
  emergencyContactName: string;
  emergencyContactNumber: string;
  primaryPhysician: string;
  insuranceProvider: string;
  insurancePolicyNumber: string;
  allergies: string | undefined;
  currentMedication: string | undefined;
  familyMedicalHistory: string | undefined;
  pastMedicalHistory: string | undefined;
  identificationType: string | undefined;
  identificationNumber: string | undefined;
  // Path in the private storage bucket; turn it into a link with createSignedDocumentUrl()
  identificationDocumentId: string | null;
  privacyConsent: boolean;
}

export interface Appointment extends BaseDocument {
  patient: Patient;
  patientId: string;
  schedule: Date;
  status: Status;
  primaryPhysician: string;
  reason: string;
  note: string;
  userId: string;
  cancellationReason: string | null;
}
