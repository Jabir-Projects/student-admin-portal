"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  LayoutDashboard,
  Menu,
  ReceiptText,
  ScrollText,
  Settings,
  ShieldCheck,
  Tags,
  Upload,
  UserRound,
  Users,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";

import type {
  StaffNavigationIcon,
  StaffNavigationItem,
} from "@/features/staff/navigation";
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
  const [isOpen, setIsOpen] = useState(false);
  const openerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const opener = openerRef.current;
    const drawer = drawerRef.current;
    if (!drawer) return;
    const activeDrawer = drawer;

    const focusableSelector = [
      "a[href]",
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      '[tabindex]:not([tabindex="-1"])',
    ].join(",");

    function getFocusableElements(): HTMLElement[] {
      return Array.from(
        activeDrawer.querySelectorAll<HTMLElement>(focusableSelector),
      );
    }

    getFocusableElements()[0]?.focus();

    function handleDrawerKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
        return;
      }
      if (event.key !== "Tab") return;

      const focusableElements = getFocusableElements();
      const firstElement = focusableElements[0];
      const lastElement = focusableElements.at(-1);
      if (!firstElement || !lastElement) {
        event.preventDefault();
        return;
      }

      const activeElement = document.activeElement;
      const focusIsOutsideDrawer =
        activeElement instanceof Node && !activeDrawer.contains(activeElement);
      if (event.shiftKey) {
        if (activeElement === firstElement || focusIsOutsideDrawer) {
          event.preventDefault();
          lastElement.focus();
        }
        return;
      }
      if (activeElement === lastElement || focusIsOutsideDrawer) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener("keydown", handleDrawerKeyDown);
    return () => {
      document.removeEventListener("keydown", handleDrawerKeyDown);
      if (opener?.isConnected) opener.focus();
    };
  }, [isOpen]);

  return (
    <>
      <button
        ref={openerRef}
        aria-controls="staff-mobile-navigation"
        aria-expanded={isOpen}
        aria-label="Open staff navigation"
        className="border-border bg-background text-foreground hover:bg-muted inline-flex size-10 items-center justify-center rounded-lg border lg:hidden"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        <Menu aria-hidden="true" className="size-5" />
      </button>
      {isOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Close staff navigation"
            className="bg-staff-overlay absolute inset-0"
            onClick={() => setIsOpen(false)}
            type="button"
          />
          <aside
            ref={drawerRef}
            aria-label="Staff navigation drawer"
            aria-modal="true"
            className="bg-staff-sidebar absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col border-r p-5 shadow-2xl"
            id="staff-mobile-navigation"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4">
              {branding}
              <button
                aria-label="Close staff navigation"
                className="border-border text-staff-sidebar-foreground hover:bg-staff-active inline-flex size-10 shrink-0 items-center justify-center rounded-lg border"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>
            <div className="mt-7 min-h-0 flex-1 overflow-y-auto">
              <NavigationList
                items={items}
                onNavigate={() => setIsOpen(false)}
              />
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
