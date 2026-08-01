import { SystemState } from "@/components/feedback/system-state";
import { AuthShell } from "@/components/layout/auth-shell";

export default function Loading() {
  return (
    <AuthShell>
      <SystemState
        description="We are securely checking your account and available portal."
        kind="loading"
        title="Checking your access"
      />
    </AuthShell>
  );
}
