import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { noStoreFetch } from "./supabase.config";

// Cookie-based Supabase client (anon/publishable key) used only for authentication.
// Data access still goes through the service-role client in lib/supabase.config.ts.
export const createAuthClient = async () => {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Auth checks must never come from Next's fetch cache (see noStoreFetch)
      global: { fetch: noStoreFetch },
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // The middleware refreshes the session, so this is safe to ignore.
          }
        },
      },
    }
  );
};

// Admin = a Supabase Auth user with app_metadata.role === "admin".
// app_metadata can only be changed with the service role key, so users can't grant it to themselves.
export const isAdminUser = (user: User | null | undefined) =>
  user?.app_metadata?.role === "admin";

// Verifies the session with the Supabase Auth server (getUser, not getSession,
// which would trust the cookie without checking it).
export const getAdminUser = async () => {
  const supabase = await createAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return isAdminUser(user) ? user : null;
};

// For pages: sends non-admins back to the sign-in modal.
export const requireAdminPage = async () => {
  const user = await getAdminUser();
  if (!user) redirect("/?admin=true");
  return user;
};

// For server actions: throws instead of redirecting (the actions wrap their body in try/catch,
// which would swallow Next's redirect).
export const assertAdmin = async () => {
  const user = await getAdminUser();
  if (!user) throw new Error("Unauthorized: admin access required");
  return user;
};
