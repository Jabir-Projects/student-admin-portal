import { Info, LockKeyhole } from "lucide-react";
import Link from "next/link";

import { SiteHeader } from "@/components/layout/site-header";

const services = [
  {
    title: "Register or sign in",
    description: "Create an account or sign in with approved access.",
  },
  {
    title: "Submit your request",
    description: "Choose a service and provide the required request details.",
  },
  {
    title: "Track its progress",
    description:
      "Follow updates as administration reviews and processes your request.",
  },
] as const;

export default function Home() {
  return (
    <div className="bg-paper min-h-screen">
      <SiteHeader />
      <main>
        <section className="mx-auto max-w-[75rem] px-5 py-10 sm:px-8 sm:py-14 lg:px-12 lg:py-16">
          <div className="grid items-center gap-9 min-[860px]:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)] min-[860px]:gap-12">
            <div className="min-w-0">
              <p className="text-sist-olive-dark font-mono text-xs font-semibold tracking-[0.14em] uppercase">
                SIST Student Services
              </p>
              <h1 className="text-sist-navy-dark mt-4 max-w-2xl text-[2.25rem] leading-[1.12] font-bold tracking-[-0.025em] text-balance sm:text-[2.75rem] lg:text-[3.25rem]">
                Student Administration Portal
              </h1>
              <p className="text-slate mt-5 max-w-xl text-base leading-7 sm:text-lg">
                Submit requests, track progress, and receive official updates in
                one secure place.
              </p>
            </div>

            <aside
              aria-labelledby="access-heading"
              className="border-border bg-surface rounded-lg border p-5 shadow-sm sm:p-6"
            >
              <div className="flex items-start gap-3">
                <span className="bg-sist-navy-soft text-sist-navy flex size-10 shrink-0 items-center justify-center rounded-md">
                  <LockKeyhole aria-hidden="true" className="size-5" />
                </span>
                <div>
                  <h2
                    className="text-sist-navy-dark text-lg font-semibold"
                    id="access-heading"
                  >
                    Access the portal
                  </h2>
                  <p className="text-slate mt-1 text-sm leading-6">
                    Sign in to continue, or create a student account.
                  </p>
                </div>
              </div>
              <div className="mt-5 flex flex-col gap-3 min-[860px]:flex-col min-[1120px]:flex-row sm:flex-row">
                <Link
                  className="bg-sist-navy text-surface hover:bg-sist-navy-dark inline-flex min-h-11 flex-1 items-center justify-center rounded-md px-4 text-sm font-semibold whitespace-nowrap transition-colors"
                  href="/login"
                >
                  Sign in
                </Link>
                <Link
                  className="border-sist-navy text-sist-navy hover:bg-sist-navy-soft inline-flex min-h-11 flex-1 items-center justify-center rounded-md border px-4 text-sm font-semibold whitespace-nowrap transition-colors"
                  href="/register"
                >
                  Create account
                </Link>
              </div>
            </aside>
          </div>

          <div
            className="border-sist-olive bg-sist-olive-light text-ink mt-8 flex items-start gap-3 rounded-md border-l-4 px-4 py-3 text-sm leading-6 min-[860px]:items-center"
            role="note"
          >
            <Info
              aria-hidden="true"
              className="text-sist-olive-dark mt-0.5 size-4 shrink-0 min-[860px]:mt-0"
            />
            <p>
              New student accounts require administrative approval before portal
              access.
            </p>
          </div>
        </section>

        <section className="border-border bg-surface border-y">
          <div className="mx-auto max-w-[75rem] px-5 py-10 sm:px-8 sm:py-12 lg:px-12">
            <h2
              className="text-sist-navy-dark text-2xl font-bold tracking-tight"
              id="process-heading"
            >
              How it works
            </h2>
            <ol
              aria-label="Student administration request process"
              className="mt-7 grid gap-6 min-[860px]:grid-cols-3 min-[860px]:gap-8"
            >
              {services.map((service, index) => {
                const isLast = index === services.length - 1;

                return (
                  <li
                    className="relative grid min-w-0 grid-cols-[2.5rem_1fr] gap-4 min-[860px]:block"
                    key={service.title}
                  >
                    <span className="border-sist-navy bg-surface text-sist-navy relative z-10 flex size-10 items-center justify-center rounded-full border font-mono text-xs font-semibold">
                      0{index + 1}
                    </span>
                    {!isLast ? (
                      <span
                        aria-hidden="true"
                        className="bg-border-strong absolute top-10 bottom-[-1.5rem] left-5 w-px min-[860px]:top-5 min-[860px]:right-[-2rem] min-[860px]:bottom-auto min-[860px]:left-10 min-[860px]:h-px min-[860px]:w-auto"
                      />
                    ) : null}
                    <div className="min-w-0 pt-0.5 min-[860px]:mt-4 min-[860px]:pt-0">
                      <h3 className="text-sist-navy text-base font-semibold">
                        {service.title}
                      </h3>
                      <p className="text-slate mt-1.5 max-w-xs text-sm leading-6">
                        {service.description}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>
      </main>
    </div>
  );
}
