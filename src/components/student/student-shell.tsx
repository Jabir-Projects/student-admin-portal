import Link from "next/link";
import { LayoutDashboard, Search } from "lucide-react";

import { SistBrand } from "@/components/brand/sist-brand";
import { AccountMenu } from "@/components/layout/account-menu";
import { MobileNavigationDrawer } from "@/components/layout/mobile-navigation-drawer";
import { ThemeToggle } from "@/components/staff/theme-toggle";

function StudentBranding() {
  return (
    <SistBrand
      className="flex-col items-start gap-2"
      href="/student"
      portalLabel="Student Portal"
      priority
    />
  );
}

function StudentNavigation({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Student navigation">
      <ul>
        <li>
          <Link
            aria-current="page"
            className="bg-sidebar-active text-sidebar-active-foreground flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium"
            href="/student"
            onClick={onNavigate}
          >
            <LayoutDashboard aria-hidden="true" className="size-5" />
            Dashboard
          </Link>
        </li>
      </ul>
    </nav>
  );
}

export function StudentShell({
  children,
  fullName,
}: {
  children: React.ReactNode;
  fullName: string;
}) {
  return (
    <div className="bg-background min-h-screen lg:pl-64">
      <aside className="bg-sidebar fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r px-5 py-6 lg:flex">
        <StudentBranding />
        <div className="mt-8 min-h-0 flex-1 overflow-y-auto">
          <StudentNavigation />
        </div>
      </aside>

      <header className="bg-header-surface border-border sticky top-0 z-30 border-b backdrop-blur">
        <div className="grid min-h-20 grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 sm:px-6 xl:px-8">
          <MobileNavigationDrawer
            branding={<StudentBranding />}
            closeLabel="Close student navigation"
            drawerLabel="Student navigation drawer"
            id="student-mobile-navigation"
            triggerLabel="Open student navigation"
          >
            {(close) => <StudentNavigation onNavigate={close} />}
          </MobileNavigationDrawer>
          <p className="text-sist-navy-dark hidden text-xl font-semibold lg:block">
            Dashboard
          </p>
          <div className="relative col-span-3 row-start-2 lg:col-span-1 lg:row-start-1 lg:ml-5">
            <Search
              aria-hidden="true"
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2"
            />
            <input
              aria-label="Student portal search is not available yet"
              className="border-input bg-background text-muted-foreground h-11 w-full rounded-lg border pr-4 pl-10 text-sm disabled:cursor-not-allowed disabled:opacity-100"
              disabled
              placeholder="Search will be available with student services"
              type="search"
            />
          </div>
          <div className="col-start-3 row-start-1 flex items-center justify-end gap-2">
            <ThemeToggle />
            <AccountMenu fullName={fullName} roleLabel="STUDENT" />
          </div>
        </div>
      </header>

      <main className="min-w-0 px-4 py-6 sm:px-6 xl:px-8" id="main-content">
        {children}
      </main>
    </div>
  );
}
