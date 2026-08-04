import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackBanner } from "@/components/feedback/feedback-banner";
import { getActorSessionClaims } from "@/server/auth/capabilities";
import { redirectForAuthorizationFailure } from "@/server/auth/session-routing";
import { db } from "@/server/db";
import { readStaffStudentFinance } from "@/server/finance/reads.node";
import { reverseFinanceTransactionAction } from "../../actions";
function money(value: bigint) {
  return new Intl.NumberFormat("fr-MA", {
    style: "currency",
    currency: "MAD",
  }).format(Number(value) / 100);
}
export default async function FinanceStudentPage({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ result?: string }>;
}) {
  const [{ studentId }, query] = await Promise.all([params, searchParams]);
  const result = await readStaffStudentFinance(
    await getActorSessionClaims(),
    studentId,
    db,
  );
  if (!result.ok) {
    if (result.reason === "INVALID_INPUT" || result.reason === "NOT_FOUND")
      notFound();
    redirectForAuthorizationFailure(result.reason);
  }
  const state =
    result.balanceMinor > BigInt(0)
      ? "Owed"
      : result.balanceMinor < BigInt(0)
        ? "Credit balance"
        : "Settled";
  const canReverse = result.actor.capabilities.includes(
    "FINANCE_IMPORT_APPROVE",
  );
  return (
    <div className="space-y-6">
      <Link
        className="text-sm font-semibold underline-offset-4 hover:underline"
        href="/staff/finance"
      >
        Back to Finance
      </Link>
      <header>
        <p className="text-muted-foreground text-sm">
          Student {result.student.studentNumber}
        </p>
        <h1 className="text-sist-navy-dark mt-1 text-3xl font-semibold">
          Finance record
        </h1>
      </header>
      {query.result ? (
        <FeedbackBanner
          tone={query.result === "REVERSED" ? "success" : "error"}
        >
          {query.result === "REVERSED"
            ? "The transaction has been reversed."
            : "The requested finance action could not be completed."}
        </FeedbackBanner>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Authoritative balance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold">{money(result.balanceMinor)}</p>
          <Badge
            className="mt-3"
            variant={state === "Settled" ? "success" : "secondary"}
          >
            {state}
          </Badge>
        </CardContent>
      </Card>
      <section aria-labelledby="posted-transactions">
        <h2 className="text-xl font-semibold" id="posted-transactions">
          Posted transactions
        </h2>
        {result.transactions.length ? (
          <div className="mt-3 max-w-full overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b">
                  {[
                    "Type",
                    "Amount",
                    "Billing period",
                    "Term",
                    "Effective",
                    "Posted",
                    "Reference",
                    "Description",
                    "Action",
                  ].map((label) => (
                    <th className="px-3 py-2" key={label}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.transactions.map((row) => (
                  <tr className="border-b align-top" key={row.id}>
                    <td className="px-3 py-2">{row.entryType}</td>
                    <td className="px-3 py-2">
                      {money(row.ledgerEffectMinor)}
                    </td>
                    <td className="px-3 py-2">{row.billingPeriod}</td>
                    <td className="px-3 py-2">{row.term}</td>
                    <td className="px-3 py-2">
                      {row.effectiveDate.toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2">
                      {row.postedAt.toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2">{row.sourceReference}</td>
                    <td className="px-3 py-2">{row.description || "—"}</td>
                    <td className="px-3 py-2">
                      {canReverse && row.entryType !== "REVERSAL" ? (
                        <form
                          action={reverseFinanceTransactionAction}
                          className="grid gap-2"
                        >
                          <input
                            name="studentId"
                            type="hidden"
                            value={studentId}
                          />
                          <input
                            name="transactionId"
                            type="hidden"
                            value={row.id}
                          />
                          <label
                            className="sr-only"
                            htmlFor={`reason-${row.id}`}
                          >
                            Reversal reason
                          </label>
                          <input
                            className="border-input bg-background min-h-9 rounded border px-2"
                            id={`reason-${row.id}`}
                            maxLength={1000}
                            minLength={3}
                            name="reason"
                            placeholder="Reason"
                            required
                          />
                          <Button size="sm" type="submit" variant="destructive">
                            Reverse
                          </Button>
                        </form>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <FeedbackBanner tone="info">
            No posted transactions are available.
          </FeedbackBanner>
        )}
      </section>
    </div>
  );
}
