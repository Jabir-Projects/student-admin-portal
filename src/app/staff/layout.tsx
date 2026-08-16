import type { Metadata } from "next";

import { StaffShell } from "@/components/staff/staff-shell";
import { getStaffIdentityLabel } from "@/features/staff/identity";
import { getVisibleStaffNavigation } from "@/features/staff/navigation";
import { requireStaffShellUser } from "@/server/auth/dal";
import { db } from "@/server/db";
import { countUnreadNotificationsForUser } from "@/server/notifications/reads.node";

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
  const [notificationPreview, unreadNotificationCount] = await Promise.all([
    db.notification.findMany({
      where: { userId: user.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 5,
      select: { id: true, title: true, readAt: true, createdAt: true },
    }),
    countUnreadNotificationsForUser(user.id, db),
  ]);

  return (
    <StaffShell
      fullName={fullName}
      staffLabel={getStaffIdentityLabel(user.capabilities)}
      navigation={navigation}
      notificationPreview={notificationPreview}
      unreadNotificationCount={unreadNotificationCount}
    >
      {children}
    </StaffShell>
  );
}
