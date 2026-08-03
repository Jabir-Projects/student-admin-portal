import Link from "next/link";
import { Inbox, Search, TriangleAlert } from "lucide-react";

import { StudentAccountAction } from "@/components/account-management/student-account-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { StudentAccountPageQuery } from "@/features/account-management/schemas";
import { ACADEMIC_YEARS } from "@/features/auth/constants";
import type {
  CollectionReadResult,
  StudentAccountView,
} from "@/server/account-management/reads.node";

export type StudentAccountSection = {
  kind: "pending" | "active" | "disabled";
  result: CollectionReadResult<StudentAccountView>;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Casablanca",
});

const sectionContent = {
  pending: {
    title: "Pending student accounts",
    caption: "Pending student accounts awaiting review",
    empty: "No pending student accounts match this view.",
  },
  active: {
    title: "Active student accounts",
    caption: "Active student accounts",
    empty: "No active student accounts match this view.",
  },
  disabled: {
    title: "Disabled student accounts",
    caption: "Disabled student accounts eligible for reactivation",
    empty: "No disabled student accounts match this view.",
  },
} as const;

function academicYearLabel(value: StudentAccountView["academicYear"]) {
  return (
    ACADEMIC_YEARS.find((academicYear) => academicYear.value === value)
      ?.label ?? value
  );
}

function safeTimestamp(
  kind: StudentAccountSection["kind"],
  student: StudentAccountView,
) {
  if (kind === "disabled") return student.disabledAt;
  if (kind === "active") return student.approvedAt;
  return student.createdAt;
}

function timestampLabel(kind: StudentAccountSection["kind"]) {
  if (kind === "disabled") return "Disabled";
  if (kind === "active") return "Approved";
  return "Submitted";
}

function StudentActions({
  kind,
  student,
}: {
  kind: StudentAccountSection["kind"];
  student: StudentAccountView;
}) {
  if (kind === "disabled") {
    return (
      <StudentAccountAction
        accountReference={student.accountReference}
        fullName={student.fullName}
        intent="reactivate-student"
      />
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {kind === "pending" ? (
        <StudentAccountAction
          accountReference={student.accountReference}
          fullName={student.fullName}
          intent="approve-student"
        />
      ) : null}
      <StudentAccountAction
        accountReference={student.accountReference}
        fullName={student.fullName}
        intent="disable-student"
      />
    </div>
  );
}

function StudentDetails({
  kind,
  student,
}: {
  kind: StudentAccountSection["kind"];
  student: StudentAccountView;
}) {
  const timestamp = safeTimestamp(kind, student);
  return (
    <>
      <div>
        <dt className="text-muted-foreground">Program</dt>
        <dd className="mt-0.5 break-words">{student.program}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Academic year</dt>
        <dd className="mt-0.5">{academicYearLabel(student.academicYear)}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Status</dt>
        <dd className="mt-1">
          <Badge variant={kind === "active" ? "success" : "secondary"}>
            {student.status.replaceAll("_", " ")}
          </Badge>
        </dd>
      </div>
      <div>
        <dt className="text-muted-foreground">{timestampLabel(kind)}</dt>
        <dd className="mt-0.5">
          {timestamp ? (
            <time dateTime={timestamp.toISOString()}>
              {dateFormatter.format(timestamp)}
            </time>
          ) : (
            "Not recorded"
          )}
        </dd>
      </div>
    </>
  );
}

function StudentSection({ kind, result }: StudentAccountSection) {
  const content = sectionContent[kind];
  if (!result.ok) {
    return (
      <section
        aria-labelledby={`${kind}-students-heading`}
        className="bg-staff-panel rounded-xl border p-6"
      >
        <h2
          className="text-sist-navy-dark text-xl font-semibold"
          id={`${kind}-students-heading`}
        >
          {content.title}
        </h2>
        <div className="mt-5 flex gap-3" role="alert">
          <TriangleAlert
            aria-hidden="true"
            className="text-destructive mt-0.5 size-5 shrink-0"
          />
          <p className="text-muted-foreground">
            This account section could not be loaded. Refresh and retry.
          </p>
        </div>
      </section>
    );
  }

  if (result.data.records.length === 0) {
    return (
      <section
        aria-labelledby={`${kind}-students-heading`}
        className="bg-staff-panel rounded-xl border"
      >
        <div className="border-border border-b px-6 py-5">
          <h2
            className="text-sist-navy-dark text-xl font-semibold"
            id={`${kind}-students-heading`}
          >
            {content.title}
          </h2>
        </div>
        <div className="px-6 py-10 text-center" role="status">
          <Inbox
            aria-hidden="true"
            className="text-muted-foreground mx-auto size-8"
          />
          <p className="mt-4 font-semibold">{content.empty}</p>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby={`${kind}-students-heading`}
      className="bg-staff-panel overflow-hidden rounded-xl border"
    >
      <div className="border-border border-b px-6 py-5">
        <h2
          className="text-sist-navy-dark text-xl font-semibold"
          id={`${kind}-students-heading`}
        >
          {content.title}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {result.data.totalCount} account
          {result.data.totalCount === 1 ? "" : "s"} in this view.
        </p>
      </div>
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-240 table-fixed text-left text-sm">
          <caption className="sr-only">{content.caption}</caption>
          <thead>
            <tr className="border-border border-b">
              {[
                "Student",
                "Student number",
                "Program",
                "Academic year",
                "Status",
                timestampLabel(kind),
                "Actions",
              ].map((heading) => (
                <th
                  className="px-4 py-3 font-semibold"
                  key={heading}
                  scope="col"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.data.records.map((student) => {
              const timestamp = safeTimestamp(kind, student);
              return (
                <tr
                  className="border-border border-b align-top last:border-b-0"
                  key={student.accountReference}
                >
                  <th
                    className="px-4 py-4 font-semibold break-words"
                    scope="row"
                  >
                    {student.fullName}
                  </th>
                  <td className="px-4 py-4 break-words">
                    {student.studentNumber}
                  </td>
                  <td className="px-4 py-4 break-words">{student.program}</td>
                  <td className="px-4 py-4">
                    {academicYearLabel(student.academicYear)}
                  </td>
                  <td className="px-4 py-4">
                    <Badge
                      variant={kind === "active" ? "success" : "secondary"}
                    >
                      {student.status.replaceAll("_", " ")}
                    </Badge>
                  </td>
                  <td className="px-4 py-4">
                    {timestamp ? (
                      <time dateTime={timestamp.toISOString()}>
                        {dateFormatter.format(timestamp)}
                      </time>
                    ) : (
                      "Not recorded"
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <StudentActions kind={kind} student={student} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul className="divide-border divide-y lg:hidden">
        {result.data.records.map((student) => (
          <li className="space-y-4 p-5" key={student.accountReference}>
            <div>
              <p className="font-semibold">{student.fullName}</p>
              <p className="text-muted-foreground mt-0.5 text-sm break-words">
                {student.studentNumber}
              </p>
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <StudentDetails kind={kind} student={student} />
            </dl>
            <StudentActions kind={kind} student={student} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function queryHref(query: StudentAccountPageQuery, page: number) {
  const parameters = new URLSearchParams();
  if (query.search) parameters.set("search", query.search);
  if (query.status !== "all") parameters.set("status", query.status);
  if (page !== 1) parameters.set("page", String(page));
  if (query.pageSize !== 25) parameters.set("pageSize", String(query.pageSize));
  const suffix = parameters.toString();
  return `/staff/student-accounts${suffix ? `?${suffix}` : ""}`;
}

export function StudentAccountManagement({
  canManage,
  canReactivate,
  canExport = false,
  query,
  sections,
}: {
  canManage: boolean;
  canReactivate: boolean;
  canExport?: boolean;
  query: StudentAccountPageQuery;
  sections: readonly StudentAccountSection[];
}) {
  const hasNextPage = sections.some(
    ({ result }) =>
      result.ok &&
      result.data.page * result.data.pageSize < result.data.totalCount,
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sist-olive-dark text-sm font-semibold">
            Account management
          </p>
          <h1 className="text-sist-navy-dark mt-1 text-3xl font-semibold tracking-tight">
            Student accounts
          </h1>
          <p className="text-muted-foreground mt-2 max-w-3xl leading-7">
            Search and manage only the student account states authorized for
            your current STAFF capabilities.
          </p>
        </div>
        {canExport ? (
          <Button asChild variant="outline">
            <a
              href={`/staff/student-accounts/export?${new URLSearchParams({
                ...(query.search ? { search: query.search } : {}),
                status: query.status,
              }).toString()}`}
            >
              Export CSV
            </a>
          </Button>
        ) : null}
      </header>

      <form
        action="/staff/student-accounts"
        className="bg-staff-panel grid gap-4 rounded-xl border p-5 md:grid-cols-[minmax(0,1fr)_auto_auto_auto]"
        method="get"
      >
        <label className="grid gap-1.5">
          <span className="text-sm font-semibold">Search students</span>
          <span className="relative">
            <Search
              aria-hidden="true"
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            />
            <input
              className="border-input bg-background h-10 w-full rounded-md border pr-3 pl-9 text-sm"
              defaultValue={query.search}
              maxLength={100}
              name="search"
              placeholder="Full name or student number"
              type="search"
            />
          </span>
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-semibold">Account status</span>
          <select
            className="border-input bg-background h-10 rounded-md border px-3 text-sm"
            defaultValue={query.status}
            name="status"
          >
            <option value="all">All authorized</option>
            {canManage ? <option value="pending">Pending</option> : null}
            {canManage ? <option value="active">Active</option> : null}
            {canReactivate ? <option value="disabled">Disabled</option> : null}
          </select>
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-semibold">Accounts per section</span>
          <select
            className="border-input bg-background h-10 rounded-md border px-3 text-sm"
            defaultValue={query.pageSize}
            name="pageSize"
          >
            <option value="25">25</option>
            <option value="50">50</option>
          </select>
        </label>
        <div className="flex items-end">
          <Button className="w-full md:w-auto" type="submit">
            Apply filters
          </Button>
        </div>
      </form>

      {sections.map((section) => (
        <StudentSection key={section.kind} {...section} />
      ))}

      <nav
        aria-label="Student account pages"
        className="flex items-center justify-between gap-4"
      >
        {query.page > 1 ? (
          <Button asChild variant="outline">
            <Link href={queryHref(query, query.page - 1)}>Previous page</Link>
          </Button>
        ) : (
          <Button disabled type="button" variant="outline">
            Previous page
          </Button>
        )}
        <span className="text-muted-foreground text-sm">
          Page {query.page} · Up to {query.pageSize} per section
        </span>
        {hasNextPage ? (
          <Button asChild variant="outline">
            <Link href={queryHref(query, query.page + 1)}>Next page</Link>
          </Button>
        ) : (
          <Button disabled type="button" variant="outline">
            Next page
          </Button>
        )}
      </nav>
    </div>
  );
}
