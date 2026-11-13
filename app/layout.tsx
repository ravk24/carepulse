import type { Metadata } from "next";
// react-datepicker's CSS is loaded here, not in the lazily loaded DatePickerField. A CSS import
// inside a next/dynamic chunk occasionally left a duplicate <link> that never finished loading.
// React 19 waits for stylesheets before showing a new page, so router.push() to a page with a
// date picker could hang forever (found by stress-running the UI-15 keyboard E2E test).
// ~22 KB (~4 KB gzipped) on every page is a fair price for that.
import "react-datepicker/dist/react-datepicker.css";
import "./globals.css";
import { Plus_Jakarta_Sans as FontSans } from "next/font/google";

import { cn } from "@/lib/utils"; //cn -> this is installed for us as soon we install tailwind css, allowing to enable adding dynamic classes to compnents

const fontSans = FontSans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "CarePulse",
  description:
    "A healthcare patient management System designed to streamline patient registration, appointment scheduling, and medical records management for healthcare providers.",
  icons: {
    icon: "/assets/icons/logo-icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // The app is dark-only, so dark mode is set in the server HTML itself rather than by a
    // client-side theme script (which could be overridden by a stale localStorage value
    // or lost after a hydration mismatch, leaving black text on the dark background).
    <html lang="en" className="dark" style={{ colorScheme: "dark" }}>
      <body
        className={cn(
          "min-h-screen bg-dark-300 font-sans text-white antialiased",
          fontSans.variable
        )}
      >
        {children}
      </body>
    </html>
  );
}
