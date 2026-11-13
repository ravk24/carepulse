import { createClient } from "@supabase/supabase-js";

// Creates (or reuses) the test auth users in the LOCAL Supabase:
//   - an admin  (app_metadata.role = "admin")
//   - a normal signed-up user without the role (to prove non-admins are rejected)
// Shared by the Vitest integration global setup and the Playwright global setup.
export async function ensureTestUsers() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!/127\.0\.0\.1|localhost/.test(url)) {
    throw new Error(`Refusing to create test users on a non-local Supabase (${url})`);
  }

  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const users = [
    { email: process.env.TEST_ADMIN_EMAIL!, password: process.env.TEST_ADMIN_PASSWORD!, role: "admin" },
    // Separate admin for the sign-out test: Supabase signOut() is global by default and would revoke
    // the shared cached session of TEST_ADMIN_EMAIL that other tests use in parallel
    { email: process.env.TEST_SIGNOUT_ADMIN_EMAIL!, password: process.env.TEST_ADMIN_PASSWORD!, role: "admin" },
    { email: process.env.TEST_USER_EMAIL!, password: process.env.TEST_USER_PASSWORD!, role: undefined },
  ];

  for (const u of users) {
    const { error } = await admin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      app_metadata: u.role ? { role: u.role } : {},
    });
    // Already exists from an earlier run -> fine (idempotent)
    if (error && !/already/i.test(error.message)) throw error;
  }
}
