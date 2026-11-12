"use server";

import { redirect } from "next/navigation";

import { createAuthClient, isAdminUser } from "../auth";

// SIGN IN ADMIN
export const signInAdmin = async ({
  email,
  password,
}: {
  email: string;
  password: string;
}): Promise<{ error?: string }> => {
  const supabase = await createAuthClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  // Same message for wrong credentials and non-admins, so the form doesn't reveal which accounts exist.
  if (error || !isAdminUser(data.user)) {
    if (data?.user) await supabase.auth.signOut();
    return { error: "Invalid email or password." };
  }

  return {};
};

// SIGN OUT ADMIN
export const signOutAdmin = async () => {
  const supabase = await createAuthClient();
  await supabase.auth.signOut();
  redirect("/");
};
