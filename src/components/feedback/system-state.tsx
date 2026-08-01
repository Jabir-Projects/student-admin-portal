import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileQuestion,
  Inbox,
  LoaderCircle,
  LockKeyhole,
  ShieldAlert,
  UserX,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SystemStateKind =
  | "disabled"
  | "empty"
  | "error"
  | "forbidden"
  | "loading"
  | "not-found"
  | "pending"
  | "session-ended"
  | "success"
  | "unauthorized";

const statePresentation: Record<
  SystemStateKind,
  { icon: LucideIcon; tone: string }
> = {
  disabled: { icon: UserX, tone: "bg-warning-soft text-warning" },
  empty: { icon: Inbox, tone: "bg-muted text-muted-foreground" },
  error: { icon: AlertTriangle, tone: "bg-destructive/10 text-destructive" },
  forbidden: { icon: ShieldAlert, tone: "bg-warning-soft text-warning" },
  loading: { icon: LoaderCircle, tone: "bg-info-soft text-info" },
  "not-found": { icon: FileQuestion, tone: "bg-muted text-muted-foreground" },
  pending: { icon: Clock3, tone: "bg-warning-soft text-warning" },
  "session-ended": { icon: LockKeyhole, tone: "bg-info-soft text-info" },
  success: { icon: CheckCircle2, tone: "bg-success-soft text-success" },
  unauthorized: { icon: ShieldAlert, tone: "bg-warning-soft text-warning" },
};

type SystemStateProps = {
  action?: React.ReactNode;
  actionHref?: string;
  actionLabel?: string;
  className?: string;
  code?: string;
  description: string;
  icon?: LucideIcon;
  kind: SystemStateKind;
  title: string;
};

export function SystemState({
  action,
  actionHref,
  actionLabel,
  className,
  code,
  description,
  icon,
  kind,
  title,
}: SystemStateProps) {
  const { icon: defaultIcon, tone } = statePresentation[kind];
  const Icon = icon ?? defaultIcon;
  const isLoading = kind === "loading";

  return (
    <section
      aria-busy={isLoading || undefined}
      aria-labelledby="system-state-heading"
      className={cn(
        "bg-card w-full rounded-xl border p-7 text-center shadow-sm sm:p-9",
        className,
      )}
      role={isLoading ? "status" : kind === "error" ? "alert" : undefined}
    >
      <span
        className={cn(
          "mx-auto inline-flex size-14 items-center justify-center rounded-xl",
          tone,
        )}
      >
        <Icon
          aria-hidden="true"
          className={cn("size-7", isLoading && "animate-spin")}
        />
      </span>
      {code ? (
        <p className="text-primary mt-6 text-sm font-bold tracking-[0.2em]">
          {code}
        </p>
      ) : null}
      <h1
        className="text-sist-navy-dark mt-4 text-2xl font-bold tracking-tight sm:text-3xl"
        id="system-state-heading"
      >
        {title}
      </h1>
      <p className="text-muted-foreground mx-auto mt-3 max-w-md leading-7">
        {description}
      </p>
      {action ??
        (actionHref && actionLabel ? (
          <Button asChild className="mt-7">
            <Link href={actionHref}>{actionLabel}</Link>
          </Button>
        ) : null)}
    </section>
  );
}
