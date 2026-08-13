import Link from "next/link";
import { redirect } from "next/navigation";

import { FeedbackBanner } from "@/components/feedback/feedback-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getActorSessionClaims } from "@/server/auth/capabilities";
import { redirectForAuthorizationFailure } from "@/server/auth/session-routing";
import { db } from "@/server/db";
import { listRegistryImportBatches } from "@/server/registry-import/reads.node";
import { uploadRegistryImportAction } from "./actions";

export const dynamic = "force-dynamic";

const feedbackMessages: Record<string, string> = {
  INVALID_FILE: "The file could not be accepted. Check its format and limits.",
  DUPLICATE_FILE: "This exact file has already been uploaded.",
  MIME_MISMATCH: "The file extension and content type do not match.",
  INVALID_UTF8: "The CSV file must use valid UTF-8 encoding.",
  MALFORMED_CSV: "The CSV structure is malformed.",
  MALFORMED_XLSX: "The XLSX workbook is malformed.",
  UNSAFE_ARCHIVE:
    "The workbook archive is unsafe or exceeds structural limits.",
  ENCRYPTED_WORKBOOK: "Encrypted workbooks are not accepted.",
  MACRO_WORKBOOK: "Macro-enabled workbooks are not accepted.",
  EXTERNAL_LINKS: "Workbooks containing external links are not accepted.",
  MULTIPLE_WORKSHEETS: "The workbook must contain exactly one worksheet.",
  FORMULA_CELL: "Formula cells are not accepted.",
  FILE_TOO_LARGE: "The file exceeds the 5 MiB limit.",
  TOO_MANY_ROWS: "The file exceeds the 5,000-row limit.",
};

export default async function RegistryImportsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; result?: string }>;
}) {
  const query = await searchParams;
  const result = await listRegistryImportBatches(
    await getActorSessionClaims(),
    query.page ?? 1,
    db,
  );
  if (!result.ok) {
    if (result.reason === "INVALID_INPUT") redirect("/staff/imports/registry");
    redirectForAuthorizationFailure(result.reason);
  }
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sist-olive-dark text-sm font-semibold">
          Controlled imports
        </p>
        <h1 className="text-sist-navy-dark mt-1 text-3xl font-semibold">
          Student Registry imports
        </h1>
        <p className="text-muted-foreground mt-2 max-w-3xl">
          Upload a UTF-8 CSV or one-sheet XLSX file for validation. Files are
          limited to 5 MiB and 5,000 rows; formulas, macros, external links, and
          encrypted workbooks are rejected.
        </p>
      </header>
      {query.result ? (
        <FeedbackBanner tone="error">
          {feedbackMessages[query.result] ??
            "The import operation could not be completed."}
        </FeedbackBanner>
      ) : null}
      {result.canUpload ? (
        <Card>
          <CardHeader>
            <CardTitle>Upload registry file</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0">
            <form
              action={uploadRegistryImportAction}
              className="grid min-w-0 gap-4"
            >
              <label className="grid min-w-0 gap-1.5">
                <span className="text-sm font-semibold">CSV or XLSX file</span>
                <input
                  accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="border-input bg-background min-h-11 w-full max-w-full min-w-0 rounded-md border px-3 py-2"
                  name="file"
                  required
                  type="file"
                />
              </label>
              <p className="text-muted-foreground text-sm [overflow-wrap:anywhere] break-words">
                Required headers: student_number, full_name, email, program,
                academic_year. Optional status defaults to ACTIVE.
              </p>
              <Button className="w-fit" type="submit">
                Upload and validate
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
      <section aria-labelledby="registry-batches-heading">
        <h2 className="text-xl font-semibold" id="registry-batches-heading">
          {result.canApprove
            ? "Available review queue and owned batches"
            : "Your batches"}
        </h2>
        {result.batches.length === 0 ? (
          <p
            className="bg-staff-panel mt-3 rounded-xl border p-8 text-center"
            role="status"
          >
            No registry import batches are available.
          </p>
        ) : (
          <div className="mt-3 grid gap-3">
            {result.batches.map((batch) => (
              <Card key={batch.id}>
                <CardContent className="grid gap-3 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold">
                        {batch.originalFilename}
                      </p>
                      <Badge
                        variant={
                          batch.status === "APPROVED" ? "success" : "secondary"
                        }
                      >
                        {batch.status.replaceAll("_", " ")}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {batch.totalRows} rows · {batch.validRows} valid ·{" "}
                      {batch.invalidRows} invalid · uploaded by{" "}
                      {batch.uploader.fullName} on{" "}
                      {batch.uploadedAt.toLocaleString()}
                    </p>
                  </div>
                  <Button asChild variant="outline">
                    <Link href={`/staff/imports/registry/${batch.id}`}>
                      View batch
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
