import Link from "next/link";

import { SystemState } from "@/components/feedback/system-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatAcademicYear,
  formatEnumLabel,
} from "@/features/student-portal/schemas";
import { getActorSessionClaims } from "@/server/auth/capabilities";
import { redirectForAuthorizationFailure } from "@/server/auth/session-routing";
import { db } from "@/server/db";
import { getStudentDashboard } from "@/server/student-portal/reads.node";

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);

export default async function StudentPage() {
  const result = await getStudentDashboard(await getActorSessionClaims(), db);
  if (!result.ok) redirectForAuthorizationFailure(result.reason);
  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <header>
        <p className="text-muted-foreground text-sm font-medium">
          Student dashboard
        </p>
        <h1 className="text-sist-navy-dark mt-1 text-3xl font-bold">
          Welcome, {result.actor.fullName}
        </h1>
        <p className="text-muted-foreground mt-2">
          {result.actor.program} ·{" "}
          {formatAcademicYear(result.actor.academicYear)}
        </p>
      </header>
      <section
        aria-label="Request summary"
        className="grid gap-4 sm:grid-cols-3"
      >
        {[
          { label: "Total requests", value: result.summary.total },
          { label: "Active requests", value: result.summary.active },
          { label: "Closed requests", value: result.summary.closed },
        ].map((item) => (
          <Card key={item.label}>
            <CardHeader>
              <CardTitle className="text-base">{item.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </section>
      <section className="grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
        <Card>
          <CardHeader>
            <CardTitle>Recent requests</CardTitle>
          </CardHeader>
          <CardContent>
            {result.recent.length === 0 ? (
              <SystemState
                actionHref="/student/requests/new"
                actionLabel="Browse request catalogue"
                description="Submit your first administrative request when you are ready."
                kind="empty"
                title="No requests yet"
              />
            ) : (
              <ul className="divide-border divide-y">
                {result.recent.map((request) => (
                  <li
                    className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"
                    key={request.id}
                  >
                    <div>
                      <Link
                        className="font-semibold hover:underline"
                        href={`/student/requests/${request.id}`}
                      >
                        {request.category.name}
                      </Link>
                      <p className="text-muted-foreground mt-1 text-sm">
                        Submitted {formatDate(request.createdAt)}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {formatEnumLabel(request.status)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card className="md:w-72">
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Button asChild>
              <Link href="/student/requests/new">Request a document</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/student/requests">My requests</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/student/documents">My documents</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/student/profile">View profile</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
