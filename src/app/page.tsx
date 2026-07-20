import { Bell, FileCheck2, ShieldCheck, Waypoints } from "lucide-react";

import { SiteHeader } from "@/components/layout/site-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const services = [
  {
    title: "Submit clearly",
    description:
      "Choose an administrative service and send a structured request.",
    icon: FileCheck2,
  },
  {
    title: "Track every step",
    description:
      "Follow progress through a transparent, time-stamped request history.",
    icon: Waypoints,
  },
  {
    title: "Stay informed",
    description:
      "Receive focused updates when the administration takes action.",
    icon: Bell,
  },
] as const;

export default function Home() {
  return (
    <div className="via-background min-h-screen bg-linear-to-b from-blue-50/80 to-emerald-50/50">
      <SiteHeader />
      <main>
        <section className="mx-auto grid max-w-7xl gap-14 px-6 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8 lg:py-28">
          <div>
            <Badge variant="success">
              <ShieldCheck aria-hidden="true" />
              Secure student services
            </Badge>
            <h1 className="text-foreground mt-6 max-w-3xl text-4xl font-bold tracking-tight text-balance sm:text-6xl">
              Administration requests, without the uncertainty.
            </h1>
            <p className="text-muted-foreground mt-6 max-w-2xl text-lg leading-8">
              One clear place for students to submit requests, follow progress,
              and receive official updates from university administration.
            </p>
            <div className="mt-8 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              Portal access will be enabled when secure authentication is added
              in Phase 2.
            </div>
          </div>

          <Card className="overflow-hidden shadow-xl shadow-blue-950/8">
            <CardHeader className="bg-muted/40 border-b">
              <p className="text-primary text-sm font-semibold">How it works</p>
              <CardTitle>Simple from request to completion</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 pt-6">
              {services.map((service, index) => {
                const Icon = service.icon;

                return (
                  <article
                    className="bg-card flex gap-4 rounded-xl border p-4"
                    key={service.title}
                  >
                    <div className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-lg">
                      <Icon aria-hidden="true" className="size-5" />
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs font-bold tracking-widest">
                        0{index + 1}
                      </p>
                      <h2 className="mt-1 font-semibold">{service.title}</h2>
                      <p className="text-muted-foreground mt-1 text-sm leading-6">
                        {service.description}
                      </p>
                    </div>
                  </article>
                );
              })}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
