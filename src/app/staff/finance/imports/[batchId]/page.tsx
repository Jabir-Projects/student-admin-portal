import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackBanner } from "@/components/feedback/feedback-banner";
import { getActorSessionClaims } from "@/server/auth/capabilities";
import { redirectForAuthorizationFailure } from "@/server/auth/session-routing";
import { db } from "@/server/db";
import { getFinanceImportBatch } from "@/server/finance/reads.node";
import {
  approveFinanceImportAction,
  rejectFinanceImportAction,
  submitFinanceImportAction,
} from "../../actions";
export default async function FinanceBatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ batchId: string }>;
  searchParams: Promise<{ result?: string }>;
}) {
  const [{ batchId }, query] = await Promise.all([params, searchParams]);
  const result = await getFinanceImportBatch(
    await getActorSessionClaims(),
    batchId,
    db,
  );
  if (!result.ok) {
    if (result.reason === "INVALID_INPUT" || result.reason === "NOT_FOUND")
      notFound();
    redirectForAuthorizationFailure(result.reason);
  }
  const { batch } = result;
  const owner = batch.uploaderId === result.actor.id;
  const canSubmit = result.canUpload && owner && batch.status === "VALIDATED";
  const canReview =
    result.canApprove && !owner && batch.status === "PENDING_APPROVAL";
  return (
    <div className="space-y-6">
      <Link
        className="text-sm font-semibold underline-offset-4 hover:underline"
        href="/staff/finance/imports"
      >
        Back to Finance imports
      </Link>
      <header>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-sist-navy-dark text-3xl font-semibold">
            Finance import batch
          </h1>
          <Badge
            variant={batch.status === "APPROVED" ? "success" : "secondary"}
          >
            {batch.status.replaceAll("_", " ")}
          </Badge>
        </div>
        <p className="text-muted-foreground mt-2">
          {batch.totalRows} rows were supplied for controlled validation.
        </p>
      </header>
      {query.result ? (
        <FeedbackBanner
          tone={
            ["VALIDATED", "PENDING_APPROVAL", "APPROVED", "REJECTED"].includes(
              query.result,
            )
              ? "success"
              : "error"
          }
        >
          {query.result === "VALIDATED"
            ? "The file was uploaded and validated."
            : query.result === "PENDING_APPROVAL"
              ? "The batch was submitted for independent review."
              : query.result === "APPROVED"
                ? "The batch was approved and posted."
                : query.result === "REJECTED"
                  ? "The batch was rejected."
                  : "The requested operation could not be completed."}
        </FeedbackBanner>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Total rows", batch.totalRows],
          ["Valid rows", batch.validRows],
          ["Invalid rows", batch.invalidRows],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardHeader>
              <CardTitle>{label}</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {value}
            </CardContent>
          </Card>
        ))}
      </div>
      {owner && result.canApprove && batch.status === "PENDING_APPROVAL" ? (
        <FeedbackBanner tone="info">
          Four-eyes control: uploaders cannot review their own batches.
        </FeedbackBanner>
      ) : null}
      {canSubmit ? (
        <form action={submitFinanceImportAction}>
          <input name="batchId" type="hidden" value={batch.id} />
          <Button type="submit">Submit for approval</Button>
        </form>
      ) : null}
      {canReview ? (
        <Card>
          <CardHeader>
            <CardTitle>Independent review</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 lg:grid-cols-2">
            <form action={approveFinanceImportAction}>
              <input name="batchId" type="hidden" value={batch.id} />
              <Button type="submit">Approve complete batch</Button>
            </form>
            <form action={rejectFinanceImportAction} className="grid gap-3">
              <input name="batchId" type="hidden" value={batch.id} />
              <label className="grid gap-1.5">
                <span className="text-sm font-semibold">Rejection reason</span>
                <textarea
                  className="border-input bg-background min-h-24 rounded-md border p-3"
                  maxLength={1000}
                  minLength={3}
                  name="reason"
                  required
                />
              </label>
              <Button className="w-fit" type="submit" variant="destructive">
                Reject batch
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Safe validation preview</CardTitle>
        </CardHeader>
        <CardContent>
          {batch.rows.length ? (
            <div className="max-w-full overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b">
                    {[
                      "Row",
                      "Student",
                      "Type",
                      "Amount",
                      "Period",
                      "Term",
                      "Validation",
                    ].map((label) => (
                      <th className="px-3 py-2" key={label}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {batch.rows.map((row) => (
                    <tr className="border-b" key={row.rowNumber}>
                      <td className="px-3 py-2">{row.rowNumber}</td>
                      <td className="px-3 py-2">{row.studentNumber ?? "—"}</td>
                      <td className="px-3 py-2">{row.entryType ?? "—"}</td>
                      <td className="px-3 py-2">
                        {row.amountMinor?.toString() ?? "—"}
                      </td>
                      <td className="px-3 py-2">{row.billingPeriod ?? "—"}</td>
                      <td className="px-3 py-2">{row.term ?? "—"}</td>
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
          ) : (
            <p className="text-muted-foreground">
              No staged rows are available.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
