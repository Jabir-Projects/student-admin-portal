import { SystemState } from "@/components/feedback/system-state";
import { AuthShell } from "@/components/layout/auth-shell";

export default function PendingApprovalPage() {
  return (
    <AuthShell>
      <SystemState
        actionHref="/login"
        actionLabel="Return to sign in"
        description="Your registration has been submitted. Portal access remains unavailable until SIST administration approves the account."
        kind="pending"
        title="Administrative approval pending"
      />
    </AuthShell>
  );
}
