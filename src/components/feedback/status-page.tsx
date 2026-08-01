import { type LucideIcon } from "lucide-react";

import { SystemState } from "@/components/feedback/system-state";
import { AuthShell } from "@/components/layout/auth-shell";

type StatusPageProps = {
  actionHref?: string;
  actionLabel?: string;
  code: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

export function StatusPage({
  actionHref = "/",
  actionLabel = "Back to home",
  code,
  title,
  description,
  icon: Icon,
}: StatusPageProps) {
  return (
    <AuthShell>
      <SystemState
        actionHref={actionHref}
        actionLabel={actionLabel}
        code={code}
        description={description}
        icon={Icon}
        kind={code === "404" ? "not-found" : "forbidden"}
        title={title}
      />
    </AuthShell>
  );
}
