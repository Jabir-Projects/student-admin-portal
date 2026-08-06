import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatEnumLabel } from "@/features/student-portal/schemas";
import { getActorSessionClaims } from "@/server/auth/capabilities";
import { redirectForAuthorizationFailure } from "@/server/auth/session-routing";
import { db } from "@/server/db";
import { getStudentDocumentDetails } from "@/server/documents/reads.node";

export default async function StudentDocumentPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const { documentId } = await params;
  const result = await getStudentDocumentDetails(
    await getActorSessionClaims(),
    documentId,
    db,
  );
  if (!result.ok) redirectForAuthorizationFailure(result.reason);
  if (!result.artifact) notFound();
  const artifact = result.artifact;
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Button asChild size="sm" variant="outline">
        <Link href="/student/documents">Back to documents</Link>
      </Button>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <CardTitle>{artifact.request.category.name}</CardTitle>
            <Badge
              variant={artifact.status === "RELEASED" ? "success" : "outline"}
            >
              {formatEnumLabel(artifact.status)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground text-sm">Request</dt>
              <dd className="font-medium">
                {artifact.request.referenceNumber}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-sm">Version</dt>
              <dd className="font-medium">{artifact.version}</dd>
            </div>
          </dl>
          {artifact.status === "RELEASED" ? (
            <Button asChild className="mt-6">
              <a href={`/api/student/documents/${artifact.id}/download`}>
                Download PDF
              </a>
            </Button>
          ) : (
            <p className="text-muted-foreground mt-6" role="status">
              This document is no longer available for download.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
