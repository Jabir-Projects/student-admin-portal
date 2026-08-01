import { ChevronDown, LogOut } from "lucide-react";

import { logoutAction } from "@/app/logout/actions";

function getInitials(fullName: string): string {
  const parts = fullName.split(/\s+/u).filter(Boolean);
  if (parts.length === 0) return "S";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "";
  return `${first}${last}`.toLocaleUpperCase();
}

export function AccountMenu({
  fullName,
  roleLabel,
}: {
  fullName: string;
  roleLabel: "STAFF" | "STUDENT";
}) {
  return (
    <details className="group relative">
      <summary
        aria-label="Open account menu"
        className="hover:bg-muted flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-2 transition-colors [&::-webkit-details-marker]:hidden"
      >
        <span className="bg-secondary text-secondary-foreground inline-flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold">
          {getInitials(fullName)}
        </span>
        <span className="hidden min-w-0 text-left sm:block">
          <span className="block max-w-36 truncate text-sm font-semibold">
            {fullName}
          </span>
          <span className="text-muted-foreground block text-xs">
            {roleLabel}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className="text-muted-foreground hidden size-4 transition-transform group-open:rotate-180 sm:block"
        />
      </summary>
      <div className="bg-card absolute top-[calc(100%+0.5rem)] right-0 z-50 w-64 rounded-lg border p-2 shadow-xl">
        <div className="border-border border-b px-3 py-2">
          <p className="truncate text-sm font-semibold">{fullName}</p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Active {roleLabel} account
          </p>
        </div>
        <form action={logoutAction} className="mt-2">
          <button
            className="hover:bg-muted flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors"
            type="submit"
          >
            <LogOut aria-hidden="true" className="size-4" />
            Sign out
          </button>
        </form>
      </div>
    </details>
  );
}
