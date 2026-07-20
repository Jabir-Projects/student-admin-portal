import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";

import { StatusPage } from "@/components/feedback/status-page";

export const metadata: Metadata = {
  title: "Unauthorized",
};

export default function UnauthorizedPage() {
  return (
    <StatusPage
      code="401"
      description="You do not have permission to view this page. Sign in with an authorized account when portal access is available."
      icon={ShieldAlert}
      title="Access restricted"
    />
  );
}
