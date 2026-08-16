import { Bell } from "lucide-react";
import Link from "next/link";

import { SistBrand } from "@/components/brand/sist-brand";
import { AccountMenu as PortalAccountMenu } from "@/components/layout/account-menu";
import { PortalPageTitle } from "@/components/layout/portal-page-title";
import { NotificationBell } from "@/components/notifications/notification-bell";
import {
  DesktopStaffNavigation,
  MobileStaffNavigation,
} from "@/components/staff/staff-navigation";
import { ThemeToggle } from "@/components/staff/theme-toggle";
import type { StaffNavigationItem } from "@/features/staff/navigation";

type StaffShellProps = {
  children: React.ReactNode;
  fullName: string;
  staffLabel: string;
  navigation: readonly StaffNavigationItem[];
  notificationPreview: readonly {
    id: string;
    title: string;
    readAt: Date | null;
    createdAt: Date;
  }[];
  unreadNotificationCount: number;
};

function StaffBranding() {
  return (
    <SistBrand
      className="flex-col items-start gap-2"
      href="/staff"
      portalLabel="Staff Administration Portal"
      priority
    />
  );
}

export function AccountMenu({
  fullName,
  staffLabel = "Staff member",
}: {
  fullName: string;
  staffLabel?: string;
}) {
  return <PortalAccountMenu fullName={fullName} roleLabel={staffLabel} />;
}

function NotificationsPanel({
  notifications,
}: {
  notifications: StaffShellProps["notificationPreview"];
}) {
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
        <Link
          className="text-sist-green text-xs font-semibold"
          href="/staff/notifications"
        >
          View all
        </Link>
      </div>
      {notifications.length === 0 ? (
        <div className="bg-staff-panel-muted mt-5 rounded-lg border border-dashed px-5 py-9 text-center">
          <span className="bg-secondary text-secondary-foreground mx-auto inline-flex size-11 items-center justify-center rounded-full">
            <Bell aria-hidden="true" className="size-5" />
          </span>
          <p className="mt-4 text-sm font-semibold">No notifications yet</p>
          <p className="text-muted-foreground mt-1 text-sm leading-6">
            Request activity assigned to your account will appear here.
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {notifications.map((notification) => (
            <li
              className="bg-staff-panel-muted rounded-lg border p-3 text-sm"
              key={notification.id}
            >
              <Link
                className="font-medium hover:underline"
                href="/staff/notifications"
              >
                {notification.title}
              </Link>
              {!notification.readAt && (
                <span className="text-sist-green ml-2 text-xs font-semibold">
                  Unread
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

export function StaffShell({
  children,
  fullName,
  staffLabel,
  navigation,
  notificationPreview,
  unreadNotificationCount,
}: StaffShellProps) {
  return (
    <div className="bg-background min-h-screen min-w-0 lg:pl-64">
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
        <div className="flex min-h-20 min-w-0 items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-6 xl:px-8">
          <MobileStaffNavigation
            branding={<StaffBranding />}
            items={navigation}
          />
          <PortalPageTitle portal="staff" />
          <div className="ml-auto flex min-w-0 shrink-0 items-center justify-end gap-2">
            <NotificationBell
              href="/staff/notifications"
              unreadCount={unreadNotificationCount}
            />
            <ThemeToggle />
            <AccountMenu fullName={fullName} staffLabel={staffLabel} />
          </div>
        </div>
      </header>

      <div className="grid min-w-0 gap-5 px-3 py-5 sm:gap-6 sm:px-6 sm:py-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:px-8">
        <main className="min-w-0">{children}</main>
        <NotificationsPanel notifications={notificationPreview} />
      </div>
    </div>
  );
}
