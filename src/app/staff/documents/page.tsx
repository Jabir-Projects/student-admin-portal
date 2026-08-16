import Link from "next/link";

import {
  generateDocumentAction,
  releaseDocumentAction,
  revokeDocumentAction,
} from "@/app/staff/documents/actions";
import { FeedbackBanner } from "@/components/feedback/feedback-banner";
import { SystemState } from "@/components/feedback/system-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";
import { formatEnumLabel } from "@/features/student-portal/schemas";
import { getActorSessionClaims } from "@/server/auth/capabilities";
import { redirectForAuthorizationFailure } from "@/server/auth/session-routing";
import { db } from "@/server/db";
import { listStaffDocuments } from "@/server/documents/reads.node";

const date = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

export default async function StaffDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; result?: string }>;
}) {
  const query = await searchParams;
  const result = await listStaffDocuments(
    await getActorSessionClaims(),
    { page: query.page ?? 1 },
    db,
  );
  if (!result.ok) {
    if (result.reason === "INVALID_INPUT")
      return <p role="alert">The document queue could not be loaded.</p>;
    redirectForAuthorizationFailure(result.reason);
  }
  const capabilities = new Set(result.actor.capabilities);
  return (
    <div className="space-y-6">
      <header>
        <p className="text-muted-foreground text-sm font-semibold tracking-[0.16em] uppercase">
          Controlled documents
        </p>
        <h1 className="text-sist-navy-dark mt-2 text-3xl font-bold">
          Documents
        </h1>
        <p className="text-muted-foreground mt-2 max-w-3xl">
          Generate immutable request fulfilment PDFs, release approved versions,
          and revoke access with a recorded reason.
        </p>
      </header>
      {query.result ? (
        <FeedbackBanner tone={query.result === "success" ? "success" : "error"}>
          {query.result === "success"
            ? "The document operation completed."
            : "The document operation could not be completed."}
        </FeedbackBanner>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Eligible READY requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {result.eligibleRequests.length === 0 ? (
            <SystemState
              description="This is normal until a request reaches the Ready status."
              kind="empty"
              title="No requests are ready for document generation"
            />
          ) : (
            result.eligibleRequests.map((request) => (
              <div
                className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                key={request.id}
              >
                <div className="min-w-0">
                  <p className="font-semibold">
                    {request.referenceNumber} · {request.category.name}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {request.student.user.fullName} ·{" "}
                    {request.student.studentNumber} ·{" "}
                    {formatEnumLabel(request.deliveryMethod)}
                  </p>
                </div>
                {capabilities.has("GENERATE_DOCUMENTS") ? (
                  <form action={generateDocumentAction}>
                    <input name="requestId" type="hidden" value={request.id} />
                    <PendingSubmitButton pendingLabel="Generating…">
                      Generate PDF
                    </PendingSubmitButton>
                  </form>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Version history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {result.artifacts.length === 0 ? (
            <SystemState
              description="Generated document versions will appear here for controlled release and revocation."
              kind="empty"
              title="No document versions yet"
            />
          ) : (
            result.artifacts.map((artifact) => (
              <article className="rounded-lg border p-4" key={artifact.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {artifact.request.referenceNumber} · Version{" "}
                      {artifact.version}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {artifact.request.category.name} · Generated{" "}
                      {date.format(artifact.generatedAt)}
                    </p>
                  </div>
                  <Badge
                    variant={
                      artifact.status === "RELEASED" ? "success" : "outline"
                    }
                  >
                    {formatEnumLabel(artifact.status)}
                  </Badge>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {capabilities.has("GENERATE_DOCUMENTS") ||
                  capabilities.has("RELEASE_DOCUMENTS") ? (
                    <Button asChild size="sm" variant="outline">
                      <Link
                        href={`/api/staff/documents/${artifact.id}/download`}
                      >
                        Download
                      </Link>
                    </Button>
                  ) : null}
                  {artifact.status === "GENERATED" &&
                  capabilities.has("RELEASE_DOCUMENTS") ? (
                    <ConfirmActionDialog
                      action={releaseDocumentAction}
                      confirmLabel="Release document"
                      description="The student will be able to download this document version after release."
                      formFields={
                        <input
                          name="artifactId"
                          type="hidden"
                          value={artifact.id}
                        />
                      }
                      pendingLabel="Releasing…"
                      title="Release this document?"
                      triggerLabel="Release"
                      triggerSize="sm"
                    />
                  ) : null}
                </div>
                {artifact.status === "RELEASED" &&
                capabilities.has("REVOKE_DOCUMENTS") ? (
                  <div className="mt-4">
                    <ConfirmActionDialog
                      action={revokeDocumentAction}
                      confirmLabel="Revoke document"
                      description="This immediately removes the student's access to this document version."
                      formFields={
                        <>
                          <input
                            name="artifactId"
                            type="hidden"
                            value={artifact.id}
                          />
                          <label
                            className="grid gap-1.5"
                            htmlFor={`reason-${artifact.id}`}
                          >
                            <span className="text-sm font-semibold">
                              Revocation reason
                            </span>
                            <input
                              className="border-input bg-background h-10 min-w-0 rounded-md border px-3"
                              id={`reason-${artifact.id}`}
                              maxLength={1000}
                              minLength={3}
                              name="reason"
                              required
                            />
                          </label>
                        </>
                      }
                      pendingLabel="Revoking…"
                      title="Revoke this document?"
                      triggerLabel="Revoke"
                      triggerSize="sm"
                      triggerVariant="destructive"
                    />
                  </div>
                ) : null}
              </article>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
