import Link from "next/link";
import { ArrowLeft, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

type StatusPageProps = {
  code: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

export function StatusPage({
  code,
  title,
  description,
  icon: Icon,
}: StatusPageProps) {
  return (
    <main className="bg-muted/40 grid min-h-screen place-items-center px-6 py-16">
      <section className="bg-card w-full max-w-lg rounded-2xl border p-8 text-center shadow-sm">
        <div className="bg-primary/10 text-primary mx-auto flex size-14 items-center justify-center rounded-2xl">
          <Icon aria-hidden="true" className="size-7" />
        </div>
        <p className="text-primary mt-6 text-sm font-bold tracking-[0.2em]">
          {code}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground mt-4 leading-7">{description}</p>
        <Button asChild className="mt-8">
          <Link href="/">
            <ArrowLeft aria-hidden="true" />
            Back to home
          </Link>
        </Button>
      </section>
    </main>
  );
}
