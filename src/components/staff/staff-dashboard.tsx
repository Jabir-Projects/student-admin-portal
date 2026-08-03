import {
  Clock3,
  Inbox,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ACADEMIC_YEARS } from "@/features/auth/constants";
import type { StaffDashboardData } from "@/server/staff/dashboard.node";

const submittedAtFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Casablanca",
});

function academicYearLabel(value: string): string {
  return (
    ACADEMIC_YEARS.find((academicYear) => academicYear.value === value)
      ?.label ?? value
  );
}

function SubmissionTime({ value }: { value: Date }) {
  return (
    <time dateTime={value.toISOString()}>
      {submittedAtFormatter.format(value)}
    </time>
  );
}

function PendingStudentTable({
  records,
}: {
  records: Extract<
    StaffDashboardData["pendingStudents"],
    { status: "available" }
  >["records"];
}) {
  return (
    <>
      <div className="hidden md:block">
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <caption className="sr-only">
            Oldest pending student account submissions
          </caption>
          <thead>
            <tr className="border-border border-b">
              <th className="w-[22%] px-6 py-3 font-semibold" scope="col">
                Student
              </th>
              <th className="w-[18%] px-4 py-3 font-semibold" scope="col">
                Student number
              </th>
              <th className="w-[25%] px-4 py-3 font-semibold" scope="col">
                Program
              </th>
              <th className="w-[15%] px-4 py-3 font-semibold" scope="col">
                Academic year
              </th>
              <th className="w-[20%] px-4 py-3 pr-6 font-semibold" scope="col">
                Submitted
              </th>
            </tr>
          </thead>
          <tbody>
            {records.map((student) => (
              <tr
                className="border-border border-b last:border-b-0"
                key={`${student.studentNumber}-${student.submittedAt.toISOString()}`}
              >
                <th
                  className="px-6 py-4 align-top font-semibold break-words"
                  scope="row"
                >
                  {student.fullName}
                </th>
                <td className="px-4 py-4 align-top break-words">
                  {student.studentNumber}
                </td>
                <td className="px-4 py-4 align-top break-words">
                  {student.program}
                </td>
                <td className="px-4 py-4 align-top">
                  {academicYearLabel(student.academicYear)}
                </td>
                <td className="px-4 py-4 pr-6 align-top">
                  <SubmissionTime value={student.submittedAt} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-border divide-y md:hidden">
        {records.map((student) => (
          <li
            className="space-y-3 p-5"
            key={`${student.studentNumber}-${student.submittedAt.toISOString()}`}
          >
            <div>
              <p className="font-semibold">{student.fullName}</p>
              <p className="text-muted-foreground mt-0.5 text-sm break-words">
                {student.studentNumber}
              </p>
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Program</dt>
                <dd className="mt-0.5 break-words">{student.program}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Academic year</dt>
                <dd className="mt-0.5">
                  {academicYearLabel(student.academicYear)}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Submitted</dt>
                <dd className="mt-0.5">
                  <SubmissionTime value={student.submittedAt} />
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}

export function StaffDashboard({ data }: { data: StaffDashboardData }) {
  const hasCapabilities = data.capabilitySummary.assignedCount > 0;
  const pendingIsVisible = data.pendingStudents.status !== "hidden";
  const requestCounts = data.requestCounts ?? { status: "hidden" as const };

  return (
    <div className="space-y-6">
      <section aria-labelledby="staff-dashboard-heading">
        <p className="text-sist-olive-dark text-sm font-semibold">
          Staff administration
        </p>
        <h1
          className="text-sist-navy-dark mt-1 text-3xl font-semibold tracking-tight"
          id="staff-dashboard-heading"
        >
          Welcome, {data.fullName}
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl leading-7">
          Review the administration information currently authorized for your
          account.
        </p>
      </section>

      <section
        aria-label="Staff dashboard summaries"
        className={`grid gap-4 ${pendingIsVisible ? "sm:grid-cols-2" : ""}`}
      >
        <Card className="shadow-none">
          <CardHeader className="grid-cols-[auto_1fr] items-center">
            <span className="bg-secondary text-secondary-foreground inline-flex size-11 items-center justify-center rounded-lg">
              <ShieldCheck aria-hidden="true" className="size-5" />
            </span>
            <div>
              <p className="text-muted-foreground text-sm">
                Assigned capabilities
              </p>
              <CardTitle className="mt-1 text-3xl">
                {data.capabilitySummary.assignedCount}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm leading-6">
              Current database assignments for your active STAFF account.
            </p>
          </CardContent>
        </Card>

        {data.pendingStudents.status !== "hidden" ? (
          <Card className="shadow-none">
            <CardHeader className="grid-cols-[auto_1fr] items-center">
              <span className="bg-accent text-accent-foreground inline-flex size-11 items-center justify-center rounded-lg">
                <UserRoundCheck aria-hidden="true" className="size-5" />
              </span>
              <div>
                <p className="text-muted-foreground text-sm">
                  Pending student accounts
                </p>
                <CardTitle className="mt-1 text-3xl">
                  {data.pendingStudents.totalCount}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm leading-6">
                Student account submissions awaiting administrative review.
              </p>
            </CardContent>
          </Card>
        ) : null}
      </section>

      {requestCounts.status === "available" ? (
        <section aria-labelledby="request-counts-heading">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2
                className="text-sist-navy-dark text-xl font-semibold"
                id="request-counts-heading"
              >
                Active requests
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Current database-backed request workload.
              </p>
            </div>
            <span className="text-sist-navy-dark text-2xl font-semibold">
              {requestCounts.totalActive}
            </span>
          </div>
          <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Submitted", requestCounts.submitted],
              ["Under review", requestCounts.underReview],
              ["Approved", requestCounts.approved],
              ["Ready", requestCounts.ready],
            ].map(([label, count]) => (
              <div className="bg-staff-panel rounded-xl border p-4" key={label}>
                <dt className="text-muted-foreground text-sm">{label}</dt>
                <dd className="text-sist-navy-dark mt-1 text-2xl font-semibold">
                  {count}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {!hasCapabilities ? (
        <section
          aria-labelledby="no-capabilities-heading"
          className="bg-staff-panel rounded-xl border p-6"
        >
          <span className="bg-muted text-muted-foreground inline-flex size-11 items-center justify-center rounded-full">
            <UsersRound aria-hidden="true" className="size-5" />
          </span>
          <h2
            className="text-sist-navy-dark mt-4 text-xl font-semibold"
            id="no-capabilities-heading"
          >
            No administrative capabilities assigned
          </h2>
          <p className="text-muted-foreground mt-2 max-w-2xl leading-7">
            Your account is active, but no administrative capabilities have been
            assigned yet.
          </p>
        </section>
      ) : null}

      {data.pendingStudents.status === "empty" ? (
        <section
          aria-labelledby="pending-students-heading"
          className="bg-staff-panel rounded-xl border"
        >
          <div className="border-border border-b px-6 py-5">
            <h2
              className="text-sist-navy-dark text-xl font-semibold"
              id="pending-students-heading"
            >
              Pending student accounts
            </h2>
          </div>
          <div className="px-6 py-10 text-center" role="status">
            <Inbox
              aria-hidden="true"
              className="text-muted-foreground mx-auto size-8"
            />
            <p className="mt-4 font-semibold">No accounts pending approval</p>
            <p className="text-muted-foreground mt-1 text-sm">
              New student account submissions will appear here.
            </p>
          </div>
        </section>
      ) : null}

      {data.pendingStudents.status === "available" ? (
        <section
          aria-labelledby="pending-students-heading"
          className="bg-staff-panel overflow-hidden rounded-xl border"
        >
          <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-6 py-5">
            <div>
              <h2
                className="text-sist-navy-dark text-xl font-semibold"
                id="pending-students-heading"
              >
                Pending student accounts
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Showing up to five oldest submissions.
              </p>
            </div>
            <span className="bg-muted text-muted-foreground inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium">
              <Clock3 aria-hidden="true" className="size-3.5" />
              Oldest first
            </span>
          </div>
          <PendingStudentTable records={data.pendingStudents.records} />
        </section>
      ) : null}
    </div>
  );
}

export function StaffDashboardLoading() {
  return (
    <div
      aria-label="Loading staff dashboard"
      aria-live="polite"
      aria-busy="true"
      className="space-y-6"
      role="status"
    >
      <span className="sr-only">Loading staff dashboard</span>
      <div className="space-y-3">
        <div className="bg-muted h-4 w-32 animate-pulse rounded" />
        <div className="bg-muted h-10 w-full max-w-md animate-pulse rounded" />
        <div className="bg-muted h-5 w-full max-w-xl animate-pulse rounded" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1].map((item) => (
          <div
            aria-hidden="true"
            className="bg-card h-40 animate-pulse rounded-xl border"
            key={item}
          />
        ))}
      </div>
      <div
        aria-hidden="true"
        className="bg-card h-72 animate-pulse rounded-xl border"
      />
    </div>
  );
}
