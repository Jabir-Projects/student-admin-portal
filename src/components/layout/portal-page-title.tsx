"use client";

import { usePathname } from "next/navigation";

const studentTitles: readonly [string, string][] = [
  ["/student/requests/new", "New request"],
  ["/student/requests", "Requests"],
  ["/student/documents", "Documents"],
  ["/student/finance", "Finance"],
  ["/student/notifications", "Notifications"],
  ["/student/profile", "Profile"],
  ["/student/settings", "Settings"],
  ["/student", "Dashboard"],
];

const staffTitles: readonly [string, string][] = [
  ["/staff/student-accounts", "Student accounts"],
  ["/staff/staff-capabilities", "Staff capabilities"],
  ["/staff/request-categories", "Request categories"],
  ["/staff/imports/registry", "Registry imports"],
  ["/staff/finance/imports", "Finance imports"],
  ["/staff/finance", "Finance"],
  ["/staff/documents", "Documents"],
  ["/staff/requests", "Requests"],
  ["/staff/notifications", "Notifications"],
  ["/staff/profile", "Profile"],
  ["/staff/settings", "Settings"],
  ["/staff/audit", "Audit log"],
  ["/staff", "Dashboard"],
];

export function PortalPageTitle({ portal }: { portal: "staff" | "student" }) {
  const pathname = usePathname();
  const titles = portal === "student" ? studentTitles : staffTitles;
  const title =
    titles.find(
      ([href]) =>
        pathname === href ||
        (href !== `/${portal}` && pathname.startsWith(`${href}/`)),
    )?.[1] ?? "Dashboard";

  return (
    <p className="text-sist-navy-dark hidden text-xl font-semibold lg:block">
      {title}
    </p>
  );
}
