"use server";

import {
  SUPABASE_BUCKET,
  TABLES,
  supabase,
  toDocument,
} from "../supabase.config";
import { parseStringify } from "../utils";

// CREATE USER (returns the existing user if the email is already registered)
export const createUser = async (user: CreateUserParams) => {
  try {
    const { data: existingUser, error: findError } = await supabase
      .from(TABLES.users)
      .select("*")
      .eq("email", user.email)
      .maybeSingle();

    if (findError) throw findError;
    if (existingUser) return parseStringify(toDocument(existingUser));

    const { data: newUser, error } = await supabase
      .from(TABLES.users)
      .insert({ name: user.name, email: user.email, phone: user.phone })
      .select()
      .single();

    if (error) throw error;
    return parseStringify(toDocument(newUser));
  } catch (error) {
    console.error("An error occurred while creating a new user:", error);
  }
};

// GET USER
export const getUser = async (userId: string) => {
  try {
    const { data: user, error } = await supabase
      .from(TABLES.users)
      .select("*")
      .eq("id", userId)
      .single();

    if (error) throw error;
    return parseStringify(toDocument(user));
  } catch (error) {
    console.error(
      "An error occurred while retrieving the user details:",
      error
    );
  }
};

// REGISTER PATIENT
export const registerPatient = async ({
  identificationDocument,
  ...patient
}: RegisterUserParams) => {
  try {
    // Upload the identification document to the private Supabase Storage bucket.
    // Only the storage path is saved; use createSignedDocumentUrl() to view it.
    let identificationDocumentId: string | null = null;

    if (identificationDocument) {
      const blob = identificationDocument.get("blobFile") as Blob;
      const fileName = identificationDocument.get("fileName") as string;
      const path = `${patient.userId}/${crypto.randomUUID()}-${fileName}`;

      const { data: file, error: uploadError } = await supabase.storage
        .from(SUPABASE_BUCKET!)
        .upload(path, blob, { contentType: blob.type || undefined });

      if (uploadError) throw uploadError;

      identificationDocumentId = file.path;
    }

    const { data: newPatient, error } = await supabase
      .from(TABLES.patients)
      .insert({ ...patient, identificationDocumentId })
      .select()
      .single();

    if (error) throw error;
    return parseStringify(toDocument(newPatient));
  } catch (error) {
    console.error("An error occurred while creating a new patient:", error);
  }
};

// GET PATIENT
export const getPatient = async (userId: string) => {
  try {
    const { data: patient, error } = await supabase
      .from(TABLES.patients)
      .select("*")
      .eq("userId", userId)
      .maybeSingle();

    if (error) throw error;
    return parseStringify(toDocument(patient));
  } catch (error) {
    console.error(
      "An error occurred while retrieving the patient details:",
      error
    );
  }
};
