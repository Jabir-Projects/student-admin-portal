import { SiteHeader } from "@/components/layout/site-header";
import { cn } from "@/lib/utils";

export function PublicShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("bg-background min-h-screen", className)}>
      <SiteHeader />
      {children}
    </div>
  );
}
