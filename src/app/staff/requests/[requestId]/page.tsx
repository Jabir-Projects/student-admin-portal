import Link from "next/link";
import { notFound } from "next/navigation";

import { FeedbackBanner } from "@/components/feedback/feedback-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatEnumLabel } from "@/features/student-portal/schemas";
import { REQUEST_TRANSITIONS } from "@/server/administration/mutations.node";
import { getStaffRequestDetails } from "@/server/administration/reads.node";
import { getActorSessionClaims } from "@/server/auth/capabilities";
import { redirectForAuthorizationFailure } from "@/server/auth/session-routing";
import { db } from "@/server/db";
import {
  addRequestMessageAction,
  transitionRequestAction,
} from "@/app/staff/requests/actions";
import { generateDocumentAction } from "@/app/staff/documents/actions";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Casablanca",
});

export default async function StaffRequestDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ requestId: string }>;
  searchParams: Promise<{ result?: string }>;
}) {
  const { requestId } = await params;
  const result = await getStaffRequestDetails(
    await getActorSessionClaims(),
    requestId,
    db,
  );
  if (!result.ok) redirectForAuthorizationFailure(result.reason);
  if (!result.request) notFound();
  const request = result.request;
  const feedback = (await searchParams).result;
  const nextStatuses = REQUEST_TRANSITIONS[request.status];
  return (
    <div className="space-y-6">
      <Button asChild size="sm" variant="outline">
        <Link href="/staff/requests">Back to request queue</Link>
      </Button>
      {feedback ? (
        <FeedbackBanner
          tone={
            feedback === "transitioned" || feedback === "message-added"
              ? "success"
              : "error"
          }
        >
          {feedback === "transitioned"
            ? "The request status was updated."
            : feedback === "message-added"
              ? "The message was added."
              : "The operation could not be completed. Refresh and retry."}
        </FeedbackBanner>
      ) : null}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-sm font-medium">
            {request.referenceNumber}
          </p>
          <h1 className="text-sist-navy-dark mt-1 text-3xl font-semibold">
            {request.category.name}
          </h1>
          <p className="text-muted-foreground mt-2">
            {request.student.user.fullName} · {request.student.studentNumber}
          </p>
        </div>
        <Badge variant="outline">{formatEnumLabel(request.status)}</Badge>
      </header>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Request details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-5 sm:grid-cols-2">
                {[
                  ["Program", request.student.program],
                  [
                    "Academic year",
                    formatEnumLabel(request.student.academicYear),
                  ],
                  ["Delivery method", formatEnumLabel(request.deliveryMethod)],
                  ["Copies", String(request.copyCount)],
                  ["Submitted", dateFormatter.format(request.createdAt)],
                  ["Updated", dateFormatter.format(request.updatedAt)],
                  [
                    "Student-provided details",
                    request.details || "None provided",
                  ],
                ].map(([label, value]) => (
                  <div
                    className={
                      label === "Student-provided details"
                        ? "sm:col-span-2"
                        : ""
                    }
                    key={label}
                  >
                    <dt className="text-muted-foreground text-sm">{label}</dt>
                    <dd className="mt-1 break-words whitespace-pre-wrap">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
          {result.actor.capabilities.some((capability) =>
            [
              "GENERATE_DOCUMENTS",
              "RELEASE_DOCUMENTS",
              "REVOKE_DOCUMENTS",
            ].includes(capability),
          ) ? (
            <Card>
              <CardHeader>
                <CardTitle>Request documents</CardTitle>
              </CardHeader>
              <CardContent>
                {request.documentArtifacts.length === 0 ? (
                  <p className="text-muted-foreground">
                    No document versions have been generated.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {request.documentArtifacts.map((artifact) => (
                      <li
                        className="flex items-center justify-between gap-3 rounded-md border p-3"
                        key={artifact.id}
                      >
                        <span>Version {artifact.version}</span>
                        <Badge variant="outline">
                          {formatEnumLabel(artifact.status)}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  {request.status === "READY" &&
                  result.actor.capabilities.includes("GENERATE_DOCUMENTS") ? (
                    <form action={generateDocumentAction}>
                      <input
                        name="requestId"
                        type="hidden"
                        value={request.id}
                      />
                      <Button type="submit">Generate PDF</Button>
                    </form>
                  ) : null}
                  <Button asChild variant="outline">
                    <Link href="/staff/documents">
                      Manage document versions
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
          {nextStatuses.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Process request</CardTitle>
              </CardHeader>
              <CardContent>
                <form action={transitionRequestAction} className="grid gap-4">
                  <input name="requestId" type="hidden" value={request.id} />
                  <label className="grid gap-1.5">
                    <span className="text-sm font-semibold">Next status</span>
                    <select
                      className="border-input bg-background h-10 rounded-md border px-3"
                      name="targetStatus"
                      required
                    >
                      {nextStatuses.map((status) => (
                        <option key={status} value={status}>
                          {formatEnumLabel(status)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-sm font-semibold">
                      Rejection reason{" "}
                      <span className="text-muted-foreground font-normal">
                        (required when rejecting)
                      </span>
                    </span>
                    <textarea
                      className="border-input bg-background min-h-24 rounded-md border p-3"
                      maxLength={1000}
                      name="rejectionReason"
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-sm font-semibold">Internal note</span>
                    <textarea
                      className="border-input bg-background min-h-24 rounded-md border p-3"
                      maxLength={2000}
                      name="internalNote"
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-sm font-semibold">
                      Public student message
                    </span>
                    <textarea
                      className="border-input bg-background min-h-24 rounded-md border p-3"
                      maxLength={1000}
                      name="publicMessage"
                    />
                  </label>
                  <Button className="w-fit" type="submit">
                    Update status
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            <FeedbackBanner tone="info">
              This request is in a terminal state and cannot be changed.
            </FeedbackBanner>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Add timeline message</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={addRequestMessageAction} className="grid gap-4">
                <input name="requestId" type="hidden" value={request.id} />
                <label className="grid gap-1.5">
                  <span className="text-sm font-semibold">Visibility</span>
                  <select
                    className="border-input bg-background h-10 rounded-md border px-3"
                    name="visibility"
                  >
                    <option value="INTERNAL">Internal STAFF note</option>
                    <option value="PUBLIC">Public student message</option>
                  </select>
                </label>
                <label className="grid gap-1.5">
                  <span className="text-sm font-semibold">Message</span>
                  <textarea
                    className="border-input bg-background min-h-28 rounded-md border p-3"
                    maxLength={2000}
                    name="body"
                    required
                  />
                </label>
                <Button className="w-fit" type="submit">
                  Add message
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Operational timeline</CardTitle>
          </CardHeader>
          <CardContent>
            {request.timeline.length === 0 ? (
              <p className="text-muted-foreground">No timeline activity.</p>
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
                        : event.visibility === "INTERNAL"
                          ? "Internal STAFF note"
                          : "Public student message"}
                    </p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {dateFormatter.format(event.createdAt)}
                    </p>
                    {event.kind === "message" ? (
                      <p className="mt-2 text-sm break-words whitespace-pre-wrap">
                        {event.body}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
