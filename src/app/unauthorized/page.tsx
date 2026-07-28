import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";

import { StatusPage } from "@/components/feedback/status-page";

export const metadata: Metadata = {
  title: "Access denied",
};

export default function UnauthorizedPage() {
  return (
    <StatusPage
      actionHref="/auth/continue"
      actionLabel="Return to your portal"
      code="403"
      description="You do not have permission to access this area. Return to the portal available to your account."
      icon={ShieldAlert}
      title="Permission denied"
    />
  );
}
