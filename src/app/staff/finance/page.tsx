import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FeedbackBanner } from "@/components/feedback/feedback-banner";
import { getActorSessionClaims } from "@/server/auth/capabilities";
import { redirectForAuthorizationFailure } from "@/server/auth/session-routing";
import { db } from "@/server/db";
import { searchStaffFinance } from "@/server/finance/reads.node";
function money(value: bigint) {
  return new Intl.NumberFormat("fr-MA", {
    style: "currency",
    currency: "MAD",
  }).format(Number(value) / 100);
}
export default async function StaffFinancePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const query = await searchParams;
  const result = await searchStaffFinance(
    await getActorSessionClaims(),
    query.q ?? "",
    db,
  );
  if (!result.ok) redirectForAuthorizationFailure(result.reason);
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sist-olive-dark text-sm font-semibold">
          Authoritative finance
        </p>
        <h1 className="text-sist-navy-dark mt-1 text-3xl font-semibold">
          Student Finance
        </h1>
        <p className="text-muted-foreground mt-2 max-w-3xl">
          Search by student number to review posted balances and transactions.
        </p>
      </header>
      <form className="flex max-w-2xl gap-2">
        <label className="sr-only" htmlFor="finance-search">
          Student number
        </label>
        <input
          className="border-input bg-background min-h-11 min-w-0 flex-1 rounded-md border px-3"
          defaultValue={query.q ?? ""}
          id="finance-search"
          name="q"
          placeholder="Student number"
          type="search"
        />
        <Button type="submit">Search</Button>
      </form>
      {result.actor.capabilities.includes("EXPORT_FINANCE_DATA") ? (
        <Button asChild variant="outline">
          <Link href="/api/staff/finance/export">Export finance CSV</Link>
        </Button>
      ) : null}
      {result.actor.capabilities.some(
        (c) => c === "FINANCE_IMPORT_UPLOAD" || c === "FINANCE_IMPORT_APPROVE",
      ) ? (
        <Button asChild variant="outline">
          <Link href="/staff/finance/imports">Finance imports</Link>
        </Button>
      ) : null}
      <section aria-labelledby="finance-results">
        <h2 className="text-xl font-semibold" id="finance-results">
          {query.q ? "Search results" : "Students"}
        </h2>
        {result.students.length ? (
          <div className="mt-3 grid gap-3">
            {result.students.map((student) => (
              <Card key={student.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
                  <div>
                    <p className="font-semibold">{student.studentNumber}</p>
                    <p className="text-muted-foreground text-sm">
                      Current balance: {money(student.balanceMinor)}
                    </p>
                  </div>
                  <Button asChild variant="outline">
                    <Link href={`/staff/finance/students/${student.id}`}>
                      View finance record
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <FeedbackBanner tone="info">
            No matching finance records are available.
          </FeedbackBanner>
        )}
      </section>
    </div>
  );
}
