import { cn } from "@/lib/utils";

// Initials avatar for a doctor (e.g. "Naresh Trehan" -> "NT").
// Built from the name alone, so it also works for appointments that reference
// a doctor who is no longer in the Doctors list.
export const DoctorAvatar = ({
  name,
  className,
}: {
  name: string;
  className?: string;
}) => {
  const words = name
    .replace(/^dr\.?\s+/i, "")
    .split(/\s+/)
    .filter((w) => /^[a-z]/i.test(w));
  const initials =
    words.length > 1
      ? words[0][0] + words[words.length - 1][0]
      : (words[0]?.slice(0, 2) ?? "?");

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full border border-dark-500 bg-green-600 text-xs font-semibold uppercase text-green-500",
        className
      )}
    >
      {initials}
    </span>
  );
};
