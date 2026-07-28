import { StaffDashboard } from "@/components/staff/staff-dashboard";
import { requireStaffDashboardData } from "@/server/staff/dashboard";

export default async function StaffDashboardPage() {
  const data = await requireStaffDashboardData();
  return <StaffDashboard data={data} />;
}
