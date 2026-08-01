import { PublicShell } from "@/components/layout/public-shell";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function AuthShell({
  children,
  size = "md",
}: {
  children: React.ReactNode;
  size?: "md" | "lg";
}) {
  return (
    <PublicShell className="bg-muted/35">
      <main
        className="mx-auto grid min-h-[calc(100vh-5rem)] w-full place-items-center px-4 py-10 sm:px-6 sm:py-14"
        id="main-content"
      >
        <div className={cn("w-full", size === "lg" ? "max-w-2xl" : "max-w-md")}>
          {children}
        </div>
      </main>
    </PublicShell>
  );
}

export function AuthPanel({
  children,
  description,
  eyebrow = "SIST Student Services",
  title,
}: {
  children: React.ReactNode;
  description: string;
  eyebrow?: string;
  title: string;
}) {
  return (
    <Card className="overflow-hidden shadow-md">
      <div className="border-border bg-header-surface border-b px-6 py-6 sm:px-8">
        <p className="text-accent-strong font-mono text-xs font-semibold tracking-[0.14em] uppercase">
          {eyebrow}
        </p>
        <h1 className="text-sist-navy-dark mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
          {title}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-6">
          {description}
        </p>
      </div>
      <CardContent className="p-6 sm:p-8">{children}</CardContent>
    </Card>
  );
}
