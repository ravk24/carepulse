"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";

// The modal (Radix AlertDialog + sign-in form) only downloads when ?admin=true is present.
const AdminLoginModal = dynamic(
  () => import("./AdminLoginModal").then((m) => m.AdminLoginModal),
  { ssr: false }
);

// Reads ?admin=true on the client so the home page itself can stay fully static.
// Already-signed-in admins are redirected to /admin by middleware before this renders.
export const AdminLoginGate = () => {
  const searchParams = useSearchParams();
  return searchParams.get("admin") === "true" ? <AdminLoginModal /> : null;
};
