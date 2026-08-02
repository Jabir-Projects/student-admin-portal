import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatAcademicYear,
  formatEnumLabel,
} from "@/features/student-portal/schemas";
import { getActorSessionClaims } from "@/server/auth/capabilities";
import { redirectForAuthorizationFailure } from "@/server/auth/session-routing";
import { getStudentProfile } from "@/server/student-portal/reads.node";

export default async function StudentProfilePage() {
  const { db } = await import("@/server/db");
  const result = await getStudentProfile(await getActorSessionClaims(), db);
  if (!result.ok) redirectForAuthorizationFailure(result.reason);
  const fields = [
    ["Full name", result.actor.fullName],
    ["Email", result.actor.email],
  ];
  return (
    <div className="mx-auto max-w-4xl">
      <header>
        <p className="text-muted-foreground text-sm font-medium">
          Student portal
        </p>
        <h1 className="text-sist-navy-dark mt-1 text-3xl font-bold">
          My profile
        </h1>
        <p className="text-muted-foreground mt-2">
          Your institutional profile is read-only.
        </p>
      </header>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Student information</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-5 sm:grid-cols-2">
            {[
              ...fields,
              ["Student number", result.actor.studentNumber],
              ["Program", result.actor.program],
              ["Academic year", formatAcademicYear(result.actor.academicYear)],
              ["Account status", formatEnumLabel(result.actor.status)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-muted-foreground text-sm">{label}</dt>
                <dd className="mt-1 font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
