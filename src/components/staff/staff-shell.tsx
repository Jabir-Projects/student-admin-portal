import Image from "next/image";
import Link from "next/link";
import { Bell, ChevronDown, CircleUserRound, Search } from "lucide-react";

import { logoutAction } from "@/app/logout/actions";
import {
  DesktopStaffNavigation,
  MobileStaffNavigation,
} from "@/components/staff/staff-navigation";
import { ThemeToggle } from "@/components/staff/theme-toggle";
import type { StaffNavigationItem } from "@/features/staff/navigation";

type StaffShellProps = {
  children: React.ReactNode;
  fullName: string;
  navigation: readonly StaffNavigationItem[];
};

function StaffBranding() {
  return (
    <Link
      aria-label="SIST staff dashboard"
      className="inline-flex min-w-0 flex-col"
      href="/staff"
    >
      <span className="inline-flex w-fit rounded-md bg-white px-2 py-1">
        <Image
          alt="SIST - Superior Institute of Science and Technology"
          className="h-auto w-31"
          height={1302}
          priority
          sizes="124px"
          src="/sist-logo.jpg"
          width={2550}
        />
      </span>
      <span className="text-staff-sidebar-foreground mt-3 text-sm font-semibold">
        Staff Administration Portal
      </span>
    </Link>
  );
}

function getInitials(fullName: string): string {
  const parts = fullName.split(/\s+/u).filter(Boolean);
  if (parts.length === 0) return "S";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "";
  return `${first}${last}`.toLocaleUpperCase();
}

export function AccountMenu({ fullName }: { fullName: string }) {
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
          <span className="text-muted-foreground block text-xs">STAFF</span>
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
            Active STAFF account
          </p>
        </div>
        <form action={logoutAction} className="mt-2">
          <button
            className="hover:bg-muted flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors"
            type="submit"
          >
            <CircleUserRound aria-hidden="true" className="size-4" />
            Sign out
          </button>
        </form>
      </div>
    </details>
  );
}

function NotificationsPanel() {
  return (
    <aside
      aria-labelledby="notifications-heading"
      className="bg-staff-panel rounded-xl border p-5 xl:sticky xl:top-27 xl:self-start"
      id="notifications"
    >
      <div className="flex items-center justify-between gap-4">
        <h2
          className="text-sist-navy-dark text-lg font-semibold"
          id="notifications-heading"
        >
          Notifications
        </h2>
        <span className="text-muted-foreground text-xs font-medium">
          Panel shell
        </span>
      </div>
      <div className="bg-staff-panel-muted mt-5 rounded-lg border border-dashed px-5 py-9 text-center">
        <span className="bg-secondary text-secondary-foreground mx-auto inline-flex size-11 items-center justify-center rounded-full">
          <Bell aria-hidden="true" className="size-5" />
        </span>
        <p className="mt-4 text-sm font-semibold">
          No notification data loaded
        </p>
        <p className="text-muted-foreground mt-1 text-sm leading-6">
          Notifications will appear here when that workflow is implemented.
        </p>
      </div>
    </aside>
  );
}

export function StaffShell({
  children,
  fullName,
  navigation,
}: StaffShellProps) {
  return (
    <div className="bg-background min-h-screen lg:pl-64">
      <aside className="bg-staff-sidebar fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r px-5 py-6 lg:flex">
        <StaffBranding />
        <div className="mt-8 min-h-0 flex-1 overflow-y-auto">
          <DesktopStaffNavigation items={navigation} />
        </div>
        <p className="text-staff-sidebar-muted border-border mt-5 border-t pt-4 text-xs leading-5">
          Navigation reflects the active account&apos;s assigned capabilities.
        </p>
      </aside>

      <header className="bg-staff-topbar border-border sticky top-0 z-30 border-b backdrop-blur">
        <div className="grid min-h-20 grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 sm:px-6 xl:px-8">
          <MobileStaffNavigation
            branding={<StaffBranding />}
            items={navigation}
          />
          <p className="text-sist-navy-dark hidden text-xl font-semibold lg:block">
            Dashboard
          </p>
          <div className="relative col-span-3 row-start-2 lg:col-span-1 lg:row-start-1 lg:ml-5">
            <Search
              aria-hidden="true"
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2"
            />
            <input
              aria-label="Staff portal search is not available yet"
              className="border-input bg-background text-muted-foreground h-11 w-full rounded-lg border pr-4 pl-10 text-sm disabled:cursor-not-allowed disabled:opacity-100"
              disabled
              placeholder="Search will be available in a later package"
              type="search"
            />
          </div>
          <div className="col-start-3 row-start-1 flex items-center justify-end gap-2">
            <a
              aria-label="Go to notifications panel"
              className="border-border bg-background text-foreground hover:bg-muted inline-flex size-10 items-center justify-center rounded-lg border transition-colors"
              href="#notifications"
              title="Notifications"
            >
              <Bell aria-hidden="true" className="size-4.5" />
            </a>
            <ThemeToggle />
            <AccountMenu fullName={fullName} />
          </div>
        </div>
      </header>

      <div className="grid gap-6 px-4 py-6 sm:px-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:px-8">
        <main className="min-w-0">{children}</main>
        <NotificationsPanel />
      </div>
    </div>
  );
}
