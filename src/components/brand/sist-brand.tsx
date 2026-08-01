import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

type SistBrandProps = {
  className?: string;
  href?: string;
  portalLabel?: string;
  priority?: boolean;
  variant?: "compact" | "full";
};

export function SistBrand({
  className,
  href = "/",
  portalLabel,
  priority = false,
  variant = "full",
}: SistBrandProps) {
  return (
    <Link
      aria-label={portalLabel ? `SIST ${portalLabel}` : "SIST home"}
      className={cn("inline-flex min-w-0 items-center gap-3", className)}
      href={href}
    >
      <span className="inline-flex shrink-0 rounded-md bg-white px-2 py-1">
        <Image
          alt="SIST - Superior Institute of Science and Technology"
          className={cn(
            "h-auto object-contain",
            variant === "compact" ? "w-20 sm:w-24" : "w-28 sm:w-31",
          )}
          height={1302}
          priority={priority}
          sizes={variant === "compact" ? "96px" : "124px"}
          src="/sist-logo.jpg"
          width={2550}
        />
      </span>
      {portalLabel ? (
        <span className="min-w-0">
          <span className="text-sist-navy-dark block truncate text-sm font-semibold sm:text-base">
            {portalLabel}
          </span>
          <span className="text-muted-foreground mt-0.5 block text-xs">
            University services portal
          </span>
        </span>
      ) : null}
    </Link>
  );
}
