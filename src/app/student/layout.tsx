import type { Metadata } from "next";

import { StudentShell } from "@/components/student/student-shell";
import { requireActiveUser } from "@/server/auth/dal";
import { db } from "@/server/db";
import { countUnreadNotificationsForUser } from "@/server/notifications/reads.node";

export const metadata: Metadata = {
  title: "Student Portal",
};

export default async function StudentLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireActiveUser("STUDENT");
  const fullName = user.fullName.trim() || "Student";
  const unreadNotificationCount = await countUnreadNotificationsForUser(
    user.id,
    db,
  );

  return (
    <StudentShell
      fullName={fullName}
      unreadNotificationCount={unreadNotificationCount}
    >
      {children}
    </StudentShell>
  );
}
