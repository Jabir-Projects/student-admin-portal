import Link from "next/link";
import { notFound } from "next/navigation";

import { FeedbackBanner } from "@/components/feedback/feedback-banner";
import { CancelRequestAction } from "@/components/student/portal/cancel-request-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatEnumLabel } from "@/features/student-portal/schemas";
import { getActorSessionClaims } from "@/server/auth/capabilities";
import { redirectForAuthorizationFailure } from "@/server/auth/session-routing";
import { db } from "@/server/db";
import { getOwnedRequestDetails } from "@/server/student-portal/reads.node";

const formatDateTime = (date: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);

export default async function StudentRequestDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ requestId: string }>;
  searchParams: Promise<{ submitted?: string }>;
}) {
  const { requestId } = await params;
  const result = await getOwnedRequestDetails(
    await getActorSessionClaims(),
    requestId,
    db,
  );
  if (!result.ok) redirectForAuthorizationFailure(result.reason);
  if (!result.request) notFound();
  const request = result.request;
  return (
    <div className="mx-auto max-w-5xl">
      <Button asChild size="sm" variant="outline">
        <Link href="/student/requests">Back to requests</Link>
      </Button>
      {(await searchParams).submitted === "1" ? (
        <FeedbackBanner className="mt-5" tone="success">
          Your request was submitted successfully.
        </FeedbackBanner>
      ) : null}
      <header className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-sm font-medium">
            {request.referenceNumber}
          </p>
          <h1 className="text-sist-navy-dark mt-1 text-3xl font-bold">
            {request.category.name}
          </h1>
        </div>
        <Badge variant="outline">{formatEnumLabel(request.status)}</Badge>
      </header>
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          <CardHeader>
            <CardTitle>Request details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-5 sm:grid-cols-2">
              {[
                ["Status", formatEnumLabel(request.status)],
                ["Copies", String(request.copyCount)],
                ["Delivery method", formatEnumLabel(request.deliveryMethod)],
                ["Submitted", formatDateTime(request.createdAt)],
                ["Last updated", formatDateTime(request.updatedAt)],
                ["Additional details", request.details || "None provided"],
              ].map(([label, value]) => (
                <div
                  className={
                    label === "Additional details" ? "sm:col-span-2" : ""
                  }
                  key={label}
                >
                  <dt className="text-muted-foreground text-sm">{label}</dt>
                  <dd className="mt-1 font-medium whitespace-pre-wrap">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            {request.status === "SUBMITTED" ? (
              <div className="mt-7 border-t pt-6">
                <CancelRequestAction requestId={request.id} />
              </div>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            {request.timeline.length === 0 ? (
              <p className="text-muted-foreground">No timeline activity yet.</p>
            ) : (
              <ol className="relative border-l pl-5">
                {request.timeline.map((event) => (
                  <li
                    className="mb-6 last:mb-0"
                    key={`${event.kind}-${event.id}`}
                  >
                    <span className="bg-primary absolute -left-1.5 mt-1.5 size-3 rounded-full" />
                    <p className="font-medium">
                      {event.kind === "status"
                        ? `${event.fromStatus ? `${formatEnumLabel(event.fromStatus)} to ` : ""}${formatEnumLabel(event.toStatus)}`
                        : "Message from SIST Staff"}
                    </p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {formatDateTime(event.createdAt)}
                    </p>
                    {event.kind === "message" ? (
                      <p className="mt-2 text-sm leading-6 whitespace-pre-wrap">
                        {event.body}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {request.deliveryMethod !== "DIGITAL_DELIVERY" ? (
              <p className="text-muted-foreground">
                This request is configured for campus pickup. No digital
                download will be provided.
              </p>
            ) : request.documentArtifacts.length === 0 ? (
              <p className="text-muted-foreground">
                No released documents are available yet.
              </p>
            ) : (
              request.documentArtifacts.map((artifact) => (
                <div
                  className="flex items-center justify-between gap-3 rounded-md border p-3"
                  key={artifact.id}
                >
                  <span>Version {artifact.version}</span>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/student/documents/${artifact.id}`}>View</Link>
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
