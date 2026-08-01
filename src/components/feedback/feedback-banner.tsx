import { AlertCircle, CircleCheck, Info, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

const presentations = {
  error: {
    icon: AlertCircle,
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  info: {
    icon: Info,
    className: "border-info/30 bg-info-soft text-info",
  },
  success: {
    icon: CircleCheck,
    className: "border-success/30 bg-success-soft text-success",
  },
  warning: {
    icon: TriangleAlert,
    className: "border-warning/30 bg-warning-soft text-warning",
  },
} as const;

export function FeedbackBanner({
  children,
  className,
  id,
  tone = "info",
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
  tone?: keyof typeof presentations;
}) {
  const { icon: Icon, className: toneClassName } = presentations[tone];

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm leading-6",
        toneClassName,
        className,
      )}
      id={id}
      role="alert"
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
