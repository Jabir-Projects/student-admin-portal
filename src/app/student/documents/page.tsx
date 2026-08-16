import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SystemState } from "@/components/feedback/system-state";
import { formatEnumLabel } from "@/features/student-portal/schemas";
import { getActorSessionClaims } from "@/server/auth/capabilities";
import { redirectForAuthorizationFailure } from "@/server/auth/session-routing";
import { db } from "@/server/db";
import { listStudentDocuments } from "@/server/documents/reads.node";

export default async function StudentDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const query = await searchParams;
  const result = await listStudentDocuments(
    await getActorSessionClaims(),
    { page: query.page ?? 1 },
    db,
  );
  if (!result.ok) {
    if (result.reason === "INVALID_INPUT")
      return <p role="alert">Documents could not be loaded.</p>;
    redirectForAuthorizationFailure(result.reason);
  }
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-sist-navy-dark text-3xl font-bold">My documents</h1>
        <p className="text-muted-foreground mt-2">
          Private documents released through your SIST account.
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {result.artifacts.length === 0 ? (
          <div className="md:col-span-2">
            <SystemState
              actionHref="/student/requests"
              actionLabel="View my requests"
              description="Released digital documents will appear here when they are ready."
              kind="empty"
              title="No digital documents yet"
            />
          </div>
        ) : (
          result.artifacts.map((artifact) => (
            <Card key={artifact.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-lg">
                    {artifact.request.category.name}
                  </CardTitle>
                  <Badge
                    variant={
                      artifact.status === "RELEASED" ? "success" : "outline"
                    }
                  >
                    {formatEnumLabel(artifact.status)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  {artifact.request.referenceNumber} · Version{" "}
                  {artifact.version}
                </p>
                <Button asChild className="mt-4" variant="outline">
                  <Link href={`/student/documents/${artifact.id}`}>
                    View document
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
