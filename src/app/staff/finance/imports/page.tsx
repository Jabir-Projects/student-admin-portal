import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackBanner } from "@/components/feedback/feedback-banner";
import { getActorSessionClaims } from "@/server/auth/capabilities";
import { redirectForAuthorizationFailure } from "@/server/auth/session-routing";
import { db } from "@/server/db";
import { listFinanceImportBatches } from "@/server/finance/reads.node";
import { uploadFinanceImportAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function FinanceImportsPage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  const query = await searchParams;
  const result = await listFinanceImportBatches(
    await getActorSessionClaims(),
    db,
  );
  if (!result.ok) redirectForAuthorizationFailure(result.reason);
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sist-olive-dark text-sm font-semibold">
          Controlled imports
        </p>
        <h1 className="text-sist-navy-dark mt-1 text-3xl font-semibold">
          Finance imports
        </h1>
      </header>
      {query.result ? (
        <FeedbackBanner tone="error">
          The file could not be processed. Check its format and limits.
        </FeedbackBanner>
      ) : null}
      {result.canUpload ? (
        <Card>
          <CardHeader>
            <CardTitle>Upload finance file</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={uploadFinanceImportAction} className="grid gap-4">
              <label className="grid gap-1.5">
                <span className="text-sm font-semibold">CSV file</span>
                <input
                  accept=".csv,text/csv"
                  className="border-input bg-background min-h-11 rounded-md border px-3 py-2"
                  name="file"
                  required
                  type="file"
                />
              </label>
              <PendingSubmitButton className="w-fit" pendingLabel="Uploading…">
                Upload and validate
              </PendingSubmitButton>
            </form>
          </CardContent>
        </Card>
      ) : null}
      <section aria-labelledby="batch-list">
        <h2 className="text-xl font-semibold" id="batch-list">
          Import batches
        </h2>
        {result.batches.length ? (
          <div className="mt-3 grid gap-3">
            {result.batches.map((batch) => (
              <Card key={batch.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
                  <div>
                    <div className="flex gap-2">
                      <p className="font-semibold">{batch.originalFilename}</p>
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
                      {batch.invalidRows} invalid
                    </p>
                  </div>
                  <Button asChild variant="outline">
                    <Link href={`/staff/finance/imports/${batch.id}`}>
                      View batch
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <FeedbackBanner tone="info">
            No finance import batches are available yet. Upload a validated CSV
            file when you are ready to begin a controlled import.
          </FeedbackBanner>
        )}
      </section>
    </div>
  );
}
