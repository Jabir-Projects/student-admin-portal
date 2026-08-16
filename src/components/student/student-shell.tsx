"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  Bell,
  FilePlus2,
  FileText,
  LayoutDashboard,
  Settings,
  UserRound,
} from "lucide-react";

import { SistBrand } from "@/components/brand/sist-brand";
import { AccountMenu } from "@/components/layout/account-menu";
import { MobileNavigationDrawer } from "@/components/layout/mobile-navigation-drawer";
import { PortalPageTitle } from "@/components/layout/portal-page-title";
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
  const pathname = usePathname();
  const items = [
    { href: "/student", label: "Dashboard", icon: LayoutDashboard },
    { href: "/student/requests", label: "My Requests", icon: ClipboardList },
    { href: "/student/documents", label: "My Documents", icon: FileText },
    { href: "/student/requests/new", label: "New Request", icon: FilePlus2 },
    { href: "/student/profile", label: "Profile", icon: UserRound },
    { href: "/student/settings", label: "Settings", icon: Settings },
  ];
  return (
    <nav aria-label="Student navigation">
      <ul className="space-y-1">
        {items.map(({ href, icon: Icon, label }) => {
          const isCurrent =
            pathname === href ||
            (href !== "/student" &&
              pathname.startsWith(`${href}/`) &&
              !(
                href === "/student/requests" &&
                pathname === "/student/requests/new"
              ));
          return (
            <li key={href}>
              <Link
                aria-current={isCurrent ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
                  isCurrent
                    ? "bg-sidebar-active text-sidebar-active-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-active hover:text-sidebar-active-foreground"
                }`}
                href={href}
                onClick={onNavigate}
              >
                <Icon aria-hidden="true" className="size-5" />
                {label}
              </Link>
            </li>
          );
        })}
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
        <div className="flex min-h-20 items-center justify-between gap-3 px-4 py-3 sm:px-6 xl:px-8">
          <MobileNavigationDrawer
            branding={<StudentBranding />}
            closeLabel="Close student navigation"
            drawerLabel="Student navigation drawer"
            id="student-mobile-navigation"
            triggerLabel="Open student navigation"
          >
            {(close) => <StudentNavigation onNavigate={close} />}
          </MobileNavigationDrawer>
          <PortalPageTitle portal="student" />
          <div className="ml-auto flex items-center justify-end gap-2">
            <Link
              aria-label="View notifications"
              className="border-border bg-background text-foreground hover:bg-muted inline-flex size-10 items-center justify-center rounded-lg border transition-colors"
              href="/student/notifications"
              title="Notifications"
            >
              <Bell aria-hidden="true" className="size-4.5" />
            </Link>
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
