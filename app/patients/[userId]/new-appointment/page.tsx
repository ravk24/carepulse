import Image from "next/image";
import { redirect } from "next/navigation";
import { AppointmentForm } from "@/components/forms/AppointmentForm";
import { getPatient } from "@/lib/actions/patient.actions";
import { Logo } from "@/components/Logo";

const Appointment = async ({ params }: SearchParamProps) => {
  const { userId } = await params;
  const patient = await getPatient(userId);

  // Not registered yet -> the appointment form can't work without a patient record
  if (!patient) redirect(`/patients/${userId}/register`);
  return (
    <div className="flex h-screen max-h-screen">
      <section className="remove-scrollbar container my-auto">
        <div className="sub-container max-w-[860px] flex-1 justify-between">
          <Logo className="mb-12" priority />

          <AppointmentForm
            patientId={patient?.$id}
            userId={userId}
            type="create"
          />

          <p className="copyright mt-10 py-12">© 2025 CarePulse</p>
        </div>
      </section>

      <Image
        src="/assets/images/appointment-img.png"
        height={1500}
        width={1500}
        sizes="(min-width: 768px) 390px, 1px"
        priority
        alt=""
        className="side-img max-w-[390px] bg-bottom"
      />
    </div>
  );
};

export default Appointment;
