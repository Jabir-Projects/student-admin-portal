import {
  approveAction,
  disableByEmailAction,
  disableAction,
} from "@/app/admin/users/pending/actions";
import { Button } from "@/components/ui/button";
import { requireCapability } from "@/server/auth/capabilities";
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
        {users.length === 0 ? (
          <p>No accounts are pending approval.</p>
        ) : (
          users.map((user) => (
            <article className="rounded-lg border p-5" key={user.id}>
              <h2 className="font-semibold">{user.fullName}</h2>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">Student Number</dt>
                  <dd>{user.studentProfile?.studentNumber}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Program</dt>
                  <dd>{user.studentProfile?.program}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Academic Year</dt>
                  <dd>{user.studentProfile?.academicYear}</dd>
                </div>
              </dl>
              <div className="mt-4 flex gap-3">
                <form action={approveAction}>
                  <input name="targetUserId" type="hidden" value={user.id} />
                  <Button size="sm" type="submit">
                    Approve
                  </Button>
                </form>
                <form action={disableAction}>
                  <input name="targetUserId" type="hidden" value={user.id} />
                  <Button size="sm" type="submit" variant="destructive">
                    Disable
                  </Button>
                </form>
              </div>
            </article>
          ))
        )}
      </div>
      <section className="mt-10 border-t pt-6">
        <h2 className="text-lg font-semibold">Disable a student account</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Enter the exact registered email address to disable a pending or
          active student account.
        </p>
        <form
          action={disableByEmailAction}
          className="mt-4 flex max-w-xl gap-3"
        >
          <input
            className="border-input bg-background h-10 flex-1 rounded-md border px-3 text-sm"
            name="email"
            type="email"
            autoComplete="off"
            maxLength={320}
            required
          />
          <Button type="submit" variant="destructive">
            Disable account
          </Button>
        </form>
      </section>
    </main>
  );
}
