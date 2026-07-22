import Image from "next/image";

export function SiteHeader() {
  return (
    <header className="border-border bg-surface border-b">
      <div className="mx-auto flex min-h-19 max-w-[75rem] items-center gap-3 px-5 py-2 sm:gap-4 sm:px-8 lg:px-12">
        <Image
          alt="SIST - Superior Institute of Science and Technology"
          className="h-auto w-[5.5rem] shrink-0 sm:w-28"
          height={1302}
          sizes="(min-width: 640px) 112px, 88px"
          src="/sist-logo.jpg"
          width={2550}
        />
        <div className="border-border-strong min-w-0 border-l pl-3 sm:pl-4">
          <p className="text-sist-navy-dark text-sm leading-tight font-semibold tracking-tight sm:text-base">
            Student Administration
          </p>
          <p className="text-slate mt-1 text-xs">University services portal</p>
        </div>
      </div>
    </header>
  );
}
