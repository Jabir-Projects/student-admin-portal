"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  LayoutDashboard,
  ReceiptText,
  ScrollText,
  Settings,
  ShieldCheck,
  Tags,
  Upload,
  UserRound,
  Users,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

import type {
  StaffNavigationIcon,
  StaffNavigationItem,
} from "@/features/staff/navigation";
import { MobileNavigationDrawer } from "@/components/layout/mobile-navigation-drawer";
import { cn } from "@/lib/utils";

const icons: Record<StaffNavigationIcon, LucideIcon> = {
  audit: ScrollText,
  dashboard: LayoutDashboard,
  documents: FileText,
  finance: WalletCards,
  imports: Upload,
  profile: UserRound,
  "request-categories": Tags,
  requests: ReceiptText,
  settings: Settings,
  staff: ShieldCheck,
  students: Users,
};

type NavigationListProps = {
  items: readonly StaffNavigationItem[];
  onNavigate?: () => void;
};

function NavigationList({ items, onNavigate }: NavigationListProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Staff navigation">
      <ul className="space-y-1.5">
        {items.map((item) => {
          const Icon = icons[item.icon];
          const isCurrent =
            item.available &&
            (pathname === item.href ||
              (item.href !== "/staff" && pathname.startsWith(`${item.href}/`)));
          const content = (
            <>
              <Icon aria-hidden="true" className="size-5 shrink-0" />
              <span className="min-w-0 truncate">{item.label}</span>
            </>
          );
          const sharedClassName = cn(
            "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
            isCurrent
              ? "bg-staff-active text-staff-active-foreground"
              : "text-staff-sidebar-foreground",
          );

          return (
            <li key={item.key}>
              {item.available ? (
                <Link
                  aria-current={isCurrent ? "page" : undefined}
                  className={cn(
                    sharedClassName,
                    "hover:bg-staff-active/70 hover:text-staff-active-foreground",
                  )}
                  href={item.href}
                  onClick={onNavigate}
                >
                  {content}
                </Link>
              ) : (
                <span
                  aria-disabled="true"
                  className={cn(
                    sharedClassName,
                    "text-staff-sidebar-muted cursor-not-allowed",
                  )}
                  title={`${item.label} will be available in a later package`}
                >
                  {content}
                  <span className="sr-only">Not available yet</span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function DesktopStaffNavigation({
  items,
}: {
  items: readonly StaffNavigationItem[];
}) {
  return <NavigationList items={items} />;
}

export function MobileStaffNavigation({
  items,
  branding,
}: {
  items: readonly StaffNavigationItem[];
  branding: React.ReactNode;
}) {
  return (
    <MobileNavigationDrawer
      branding={branding}
      closeLabel="Close staff navigation"
      drawerLabel="Staff navigation drawer"
      id="staff-mobile-navigation"
      triggerLabel="Open staff navigation"
    >
      {(close) => <NavigationList items={items} onNavigate={close} />}
    </MobileNavigationDrawer>
  );
}
