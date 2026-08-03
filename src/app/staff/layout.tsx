import type { Metadata } from "next";

import { StaffShell } from "@/components/staff/staff-shell";
import { getVisibleStaffNavigation } from "@/features/staff/navigation";
import { requireStaffShellUser } from "@/server/auth/dal";
import { db } from "@/server/db";

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
  const notificationPreview = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 5,
    select: { id: true, title: true, readAt: true, createdAt: true },
  });

  return (
    <StaffShell
      fullName={fullName}
      navigation={navigation}
      notificationPreview={notificationPreview}
    >
      {children}
    </StaffShell>
  );
}
