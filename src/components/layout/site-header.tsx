import { GraduationCap } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="bg-background/90 border-b backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-6 py-4 lg:px-8">
        <div className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-xl shadow-sm">
          <GraduationCap aria-hidden="true" className="size-5" />
        </div>
        <div>
          <p className="font-semibold tracking-tight">Student Administration</p>
          <p className="text-muted-foreground text-xs">
            University services portal
          </p>
        </div>
      </div>
    </header>
  );
}
