"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInAdmin } from "@/lib/actions/auth.actions";

// Admin sign-in: credentials are checked on the server by Supabase Auth,
// which sets an httpOnly session cookie. Nothing secret lives in the browser bundle.
export const AdminLoginModal = () => {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const closeModal = () => {
    setOpen(false);
    router.push("/");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await signInAdmin({ email, password });

      if (result.error) {
        setError(result.error);
        return;
      }

      setOpen(false);
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent className="shad-alert-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-start justify-between">
            Admin Sign In
            <Image
              src="/assets/icons/close.svg"
              alt="close"
              width={20}
              height={20}
              onClick={() => closeModal()}
              className="cursor-pointer"
            />
          </AlertDialogTitle>
          <AlertDialogDescription>
            Sign in with your admin account to access the dashboard.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admin-email" className="shad-input-label">
              Email
            </Label>
            <Input
              id="admin-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="shad-input rounded-md border border-dark-500 bg-dark-400 px-3"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-password" className="shad-input-label">
              Password
            </Label>
            <Input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="shad-input rounded-md border border-dark-500 bg-dark-400 px-3"
            />
          </div>

          {error && (
            <p className="shad-error text-14-regular flex justify-center">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={isLoading}
            className="shad-primary-btn w-full"
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </Button>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
};
