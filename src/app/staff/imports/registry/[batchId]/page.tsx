import Link from "next/link";
import { notFound } from "next/navigation";

import { FeedbackBanner } from "@/components/feedback/feedback-banner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";
import { getActorSessionClaims } from "@/server/auth/capabilities";
import { redirectForAuthorizationFailure } from "@/server/auth/session-routing";
import { db } from "@/server/db";
import { getRegistryImportBatch } from "@/server/registry-import/reads.node";
import {
  approveRegistryImportAction,
  rejectRegistryImportAction,
  submitRegistryImportAction,
} from "../actions";

export default async function RegistryImportBatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ batchId: string }>;
  searchParams: Promise<{ page?: string; result?: string }>;
}) {
  const [{ batchId }, query] = await Promise.all([params, searchParams]);
  const result = await getRegistryImportBatch(
    await getActorSessionClaims(),
    { batchId, page: query.page ?? 1 },
    db,
  );
  if (!result.ok) {
    if (result.reason === "INVALID_INPUT") notFound();
    redirectForAuthorizationFailure(result.reason);
  }
  if (!result.batch) notFound();
  const { batch } = result;
  const isUploader = batch.uploader.id === result.actor.id;
  const canSubmit =
    result.canUpload && isUploader && batch.status === "VALIDATED";
  const canReview =
    result.canApprove && !isUploader && batch.status === "PENDING_APPROVAL";
  return (
    <div className="space-y-6">
      <header>
        <Link
          className="text-sm font-semibold underline-offset-4 hover:underline"
          href="/staff/imports/registry"
        >
          Back to registry imports
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-sist-navy-dark text-3xl font-semibold">
            {batch.originalFilename}
          </h1>
          <Badge
            variant={batch.status === "APPROVED" ? "success" : "secondary"}
          >
            {batch.status.replaceAll("_", " ")}
          </Badge>
        </div>
        <p className="text-muted-foreground mt-2">
          Uploaded by {batch.uploader.fullName} on{" "}
          {batch.uploadedAt.toLocaleString()}.
          {batch.reviewer ? ` Reviewed by ${batch.reviewer.fullName}.` : ""}
        </p>
      </header>
      {query.result ? (
        <FeedbackBanner
          tone={
            query.result === "APPROVED" ||
            query.result === "REJECTED" ||
            query.result === "PENDING_APPROVAL"
              ? "success"
              : "error"
          }
        >
          {query.result === "VALIDATED"
            ? "The file was uploaded and validated."
            : query.result === "PENDING_APPROVAL"
              ? "The batch was submitted for independent review."
              : query.result === "APPROVED"
                ? "The complete batch was approved and applied."
                : query.result === "REJECTED"
                  ? "The batch was rejected."
                  : "The requested batch transition could not be completed."}
        </FeedbackBanner>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total rows</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {batch.totalRows}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Valid rows</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {batch.validRows}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Invalid rows</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {batch.invalidRows}
          </CardContent>
        </Card>
      </div>
      {batch.purgedAt ? (
        <FeedbackBanner tone="info">
          Normalized staging rows were purged after retention expiry.
        </FeedbackBanner>
      ) : null}
      {isUploader &&
      result.canApprove &&
      batch.status === "PENDING_APPROVAL" ? (
        <FeedbackBanner tone="info">
          Four-eyes control: the uploader cannot approve or reject their own
          batch.
        </FeedbackBanner>
      ) : null}
      {canSubmit ? (
        <form action={submitRegistryImportAction}>
          <input name="batchId" type="hidden" value={batch.id} />
          <PendingSubmitButton pendingLabel="Submitting…">
            Submit for approval
          </PendingSubmitButton>
        </form>
      ) : null}
      {canReview ? (
        <Card>
          <CardHeader>
            <CardTitle>Independent review</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 lg:grid-cols-2">
            <ConfirmActionDialog
              action={approveRegistryImportAction}
              confirmLabel="Approve complete batch"
              description="All valid rows will be applied as one controlled batch."
              formFields={
                <input name="batchId" type="hidden" value={batch.id} />
              }
              pendingLabel="Approving…"
              title="Approve this registry batch?"
              triggerLabel="Approve complete batch"
            />
            <ConfirmActionDialog
              action={rejectRegistryImportAction}
              confirmLabel="Reject batch"
              description="This batch will not be applied. Provide the reason for the audit record."
              formFields={
                <>
                  <input name="batchId" type="hidden" value={batch.id} />
                  <label
                    className="grid gap-1.5"
                    htmlFor={`reason-${batch.id}`}
                  >
                    <span className="text-sm font-semibold">
                      Rejection reason
                    </span>
                    <textarea
                      className="border-input bg-background min-h-24 rounded-md border p-3"
                      id={`reason-${batch.id}`}
                      maxLength={500}
                      minLength={3}
                      name="reason"
                      required
                    />
                  </label>
                </>
              }
              pendingLabel="Rejecting…"
              title="Reject this registry batch?"
              triggerLabel="Reject batch"
              triggerVariant="destructive"
            />
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Normalized validation preview</CardTitle>
        </CardHeader>
        <CardContent>
          {batch.rows.length === 0 ? (
            <p className="text-muted-foreground" role="status">
              No staged rows are available.
            </p>
          ) : (
            <div className="max-w-full overflow-x-auto">
              <table className="w-full min-w-[920px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b">
                    {[
                      "Row",
                      "Student number",
                      "Full name",
                      "Email",
                      "Program",
                      "Year",
                      "Status",
                      "Operation",
                      "Validation",
                    ].map((label) => (
                      <th className="px-3 py-2 font-semibold" key={label}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {batch.rows.map((row) => (
                    <tr className="border-b align-top" key={row.rowNumber}>
                      <td className="px-3 py-2">{row.rowNumber}</td>
                      <td className="px-3 py-2">{row.studentNumber ?? "—"}</td>
                      <td className="px-3 py-2">{row.fullName ?? "—"}</td>
                      <td className="px-3 py-2">{row.email ?? "—"}</td>
                      <td className="px-3 py-2">{row.program ?? "—"}</td>
                      <td className="px-3 py-2">
                        {row.academicYear?.replaceAll("_", " ") ?? "—"}
                      </td>
                      <td className="px-3 py-2">{row.status ?? "—"}</td>
                      <td className="px-3 py-2">{row.operation ?? "—"}</td>
                      <td className="px-3 py-2">
                        {row.validation === "VALID"
                          ? "Valid"
                          : row.errorCodes.join(", ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
