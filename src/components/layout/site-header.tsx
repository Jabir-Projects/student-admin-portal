import Link from "next/link";

import { SistBrand } from "@/components/brand/sist-brand";
import { ThemeToggle } from "@/components/staff/theme-toggle";

export function SiteHeader() {
  return (
    <header className="border-border bg-header-surface border-b backdrop-blur">
      <div className="mx-auto flex min-h-20 max-w-[75rem] items-center justify-between gap-3 px-4 py-2 sm:px-8 lg:px-12">
        <SistBrand
          className="[&>span:last-child]:hidden min-[480px]:[&>span:last-child]:block"
          portalLabel="Student Administration"
          priority
          variant="compact"
        />
        <div className="flex items-center gap-1.5 sm:gap-2">
          <nav aria-label="Public navigation">
            <ul className="flex items-center gap-1 sm:gap-2">
              <li>
                <Link
                  className="hover:bg-muted inline-flex min-h-10 items-center rounded-md px-3 text-sm font-medium"
                  href="/login"
                >
                  Sign in
                </Link>
              </li>
              <li className="hidden sm:block">
                <Link
                  className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex min-h-10 items-center rounded-md px-3 text-sm font-medium"
                  href="/register"
                >
                  Register
                </Link>
              </li>
            </ul>
          </nav>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
