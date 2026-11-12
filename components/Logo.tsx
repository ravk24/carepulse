import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

// CarePulse logo that always links back to the home page. Use this on every page
// instead of a bare <Image>, so the logo is consistently clickable.
export const Logo = ({
  className,
  imageClassName = "h-10",
  priority = false,
}: {
  /** Classes for the link wrapper, e.g. spacing like "mb-12" */
  className?: string;
  /** Classes for the image itself, e.g. its height */
  imageClassName?: string;
  /** Preload when the logo is part of the first paint */
  priority?: boolean;
}) => (
  <Link
    href="/"
    aria-label="CarePulse home"
    className={cn("block w-fit cursor-pointer", className)}
  >
    <Image
      src="/assets/icons/logo-full.svg"
      height={32}
      width={162}
      alt="CarePulse"
      priority={priority}
      className={cn("w-fit", imageClassName)}
    />
  </Link>
);
