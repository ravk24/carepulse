import "server-only";
import { createClient } from "@supabase/supabase-js";

export const {
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_BUCKET = "identification-documents",
} = process.env;

// Server-side client using the service role key. It bypasses Row Level Security,
// so it must only ever be used in server code (server actions / server components).
export const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const TABLES = {
  users: "users",
  patients: "patients",
  appointments: "appointments",
} as const;

// Creates a temporary link to a file in the private documents bucket (default: 1 hour).
// Deliberately not a server action: only server components / server code can call it,
// so the browser can't request links for arbitrary files.
export const createSignedDocumentUrl = async (
  path: string | null | undefined,
  expiresInSeconds = 60 * 60
) => {
  if (!path) return null;

  const { data, error } = await supabase.storage
    .from(SUPABASE_BUCKET!)
    .createSignedUrl(path, expiresInSeconds);

  if (error) {
    console.error("An error occurred while signing the document URL:", error);
    return null;
  }
  return data.signedUrl;
};

// Keeps the old Appwrite document shape ($id, $createdAt, $updatedAt) so the UI didn't need to change.
export const toDocument = <T extends Record<string, any>>(row: T | null) => {
  if (!row) return row;
  const { id, created_at: createdAt, updated_at: updatedAt, ...rest } = row;
  return { $id: id, $createdAt: createdAt, $updatedAt: updatedAt, ...rest };
};
