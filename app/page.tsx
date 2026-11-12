import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import { AdminLoginGate } from "@/components/AdminLoginGate";
import { PatientForm } from "@/components/forms/PatientForm";

// Fully static page (no searchParams / cookies read on the server), so it's prerendered
// at build time and served straight from the CDN.
const Home = () => {
  return (
    <div className="flex h-screen max-h-screen">
      <Suspense fallback={null}>
        <AdminLoginGate />
      </Suspense>

      <section className="remove-scrollbar container my-auto">
        <div className="sub-container max-w-[496px]">
          <Link href="/" aria-label="CarePulse home">
            <Image
              src="/assets/icons/logo-full.svg"
              height={32}
              width={162}
              alt="CarePulse"
              priority
              className="mb-0 h-10 w-fit"
            />
          </Link>

          <PatientForm />

          <div className="text-14-regular mt-20 flex justify-between">
            <p className="justify-items-end text-dark-600 xl:text-left">
              © 2025 CarePulse
            </p>
            <Link href="/?admin=true" prefetch={false} className="text-green-500">
              Admin
            </Link>
          </div>
        </div>
      </section>

      <Image
        src="/assets/images/onboarding-img.png"
        height={1000}
        width={1000}
        alt=""
        sizes="(min-width: 768px) 50vw, 1px"
        priority
        className="side-img max-w-[50%]"
      />
    </div>
  );
};

export default Home;
