import type { Metadata } from "next";

import { StudentShell } from "@/components/student/student-shell";
import { requireActiveUser } from "@/server/auth/dal";

export const metadata: Metadata = {
  title: "Student Portal",
};

export default async function StudentLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireActiveUser("STUDENT");
  const fullName = user.fullName.trim() || "Student";

  return <StudentShell fullName={fullName}>{children}</StudentShell>;
}
