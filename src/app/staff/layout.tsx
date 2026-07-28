import type { Metadata } from "next";

import { StaffShell } from "@/components/staff/staff-shell";
import { getVisibleStaffNavigation } from "@/features/staff/navigation";
import { requireStaffShellUser } from "@/server/auth/dal";

export const metadata: Metadata = {
  title: "Staff Dashboard",
};

export default async function StaffLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireStaffShellUser();
  const fullName = user.fullName.trim() || "Staff member";
  const navigation = getVisibleStaffNavigation(user.capabilities);

  return (
    <StaffShell fullName={fullName} navigation={navigation}>
      {children}
    </StaffShell>
  );
}
