import Image from "next/image";
import { redirect } from "next/navigation";
import RegisterForm from "@/components/forms/RegisterForm";
import { getPatient, getUser } from "@/lib/actions/patient.actions";
import { Logo } from "@/components/Logo";

const Register = async ({ params: { userId } }: SearchParamProps) => {
  // Inside the params object, we’re specifically extracting the userId property: params: { userId }. This means the function is interested only in the userId field from the params object.
  const user = await getUser(userId);
  const patient = await getPatient(userId);

  if (patient) redirect(`/patients/${userId}/new-appointment`);

  return (
    <div className="flex h-screen max-h-screen">
      <section className="remove-scrollbar container">
        <div className="sub-container max-w-[860px] flex-1 flex-col py-10">
          <Logo className="mb-12" priority />

          <RegisterForm user={user} />

          <p className="copyright py-12">© 2025 CarePulse</p>
        </div>
      </section>

      <Image
        src="/assets/images/register-img.png"
        height={1000}
        width={1000}
        sizes="(min-width: 768px) 390px, 1px"
        priority
        alt=""
        className="side-img max-w-[390px]"
      />
    </div>
  );
};

export default Register;
