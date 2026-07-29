import { redirect } from "next/navigation";

import { legacyStudentAccountAction } from "@/app/admin/users/pending/actions";
import { Button } from "@/components/ui/button";
import { createAccountReference } from "@/server/account-management/account-reference.node";
import { requireCapability } from "@/server/auth/capabilities";
import { requireActiveUser } from "@/server/auth/dal";
import { getAuthenticationSecret } from "@/server/auth/env";
import { db } from "@/server/db";

const resultMessages = {
  approved: "The student account was approved.",
  disabled: "The student account was disabled.",
  stale: "The account status changed before this action was completed.",
  rejected: "The account transition could not be completed.",
} as const;

export default async function PendingUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  const user = await requireActiveUser(["STAFF", "ADMIN"]);
  if (user.role === "STAFF") redirect("/staff/student-accounts");
  await requireCapability("MANAGE_STUDENT_ACCOUNTS");
  const { result } = await searchParams;
  const resultMessage =
    result && result in resultMessages
      ? resultMessages[result as keyof typeof resultMessages]
      : undefined;
  const users = await db.user.findMany({
    where: { role: "STUDENT", status: "PENDING_APPROVAL" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      fullName: true,
      createdAt: true,
      studentProfile: {
        select: { studentNumber: true, program: true, academicYear: true },
      },
    },
  });
  const referenceSecret = getAuthenticationSecret(process.env);
  if (!referenceSecret) {
    throw new Error("Authentication secret is unavailable.");
  }
  const pendingAccounts = users.map((user) => ({
    accountReference: createAccountReference(
      "student",
      user.id,
      referenceSecret,
    ),
    fullName: user.fullName,
    createdAt: user.createdAt,
    studentProfile: user.studentProfile,
  }));
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-semibold">Pending student accounts</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Student Numbers shown here were submitted by applicants and are not
        institutionally verified in Phase 3.
      </p>
      {resultMessage ? (
        <p
          className="bg-muted mt-4 rounded-md border p-3 text-sm"
          role="status"
        >
          {resultMessage}
        </p>
      ) : null}
      <div className="mt-8 space-y-4">
        {pendingAccounts.length === 0 ? (
          <p>No accounts are pending approval.</p>
        ) : (
          pendingAccounts.map((account) => (
            <article
              className="rounded-lg border p-5"
              key={account.accountReference}
            >
              <h2 className="font-semibold">{account.fullName}</h2>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">Student Number</dt>
                  <dd>{account.studentProfile?.studentNumber}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Program</dt>
                  <dd>{account.studentProfile?.program}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Academic Year</dt>
                  <dd>{account.studentProfile?.academicYear}</dd>
                </div>
              </dl>
              <div className="mt-4 flex gap-3">
                <form action={legacyStudentAccountAction}>
                  <input name="intent" type="hidden" value="approve-student" />
                  <input
                    name="accountReference"
                    type="hidden"
                    value={account.accountReference}
                  />
                  <Button size="sm" type="submit">
                    Approve
                  </Button>
                </form>
                <form action={legacyStudentAccountAction}>
                  <input name="intent" type="hidden" value="disable-student" />
                  <input
                    name="accountReference"
                    type="hidden"
                    value={account.accountReference}
                  />
                  <Button size="sm" type="submit" variant="destructive">
                    Disable
                  </Button>
                </form>
              </div>
            </article>
          ))
        )}
      </div>
    </main>
  );
}
