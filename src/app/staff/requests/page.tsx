import Link from "next/link";

import { FeedbackBanner } from "@/components/feedback/feedback-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  REQUEST_STATUSES,
  formatEnumLabel,
} from "@/features/student-portal/schemas";
import { getActorSessionClaims } from "@/server/auth/capabilities";
import { redirectForAuthorizationFailure } from "@/server/auth/session-routing";
import { db } from "@/server/db";
import { listStaffRequests } from "@/server/administration/reads.node";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Casablanca",
});

function hrefFor(query: Record<string, string | undefined>, page: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (value) params.set(key, value);
  if (page !== 1) params.set("page", String(page));
  return `/staff/requests${params.size ? `?${params}` : ""}`;
}

export default async function StaffRequestsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const raw = await searchParams;
  const input = {
    page: raw.page,
    status: raw.status || undefined,
    categoryId: raw.categoryId || undefined,
    reference: raw.reference || undefined,
    student: raw.student || undefined,
  };
  const result = await listStaffRequests(
    await getActorSessionClaims(),
    input,
    db,
  );
  if (!result.ok) {
    if (result.reason !== "INVALID_INPUT")
      redirectForAuthorizationFailure(result.reason);
    return (
      <FeedbackBanner tone="error">
        The request filters are invalid.{" "}
        <Link className="underline" href="/staff/requests">
          Clear filters
        </Link>
        .
      </FeedbackBanner>
    );
  }
  const filterQuery = {
    status: result.query.status,
    categoryId: result.query.categoryId,
    reference: result.query.reference,
    student: result.query.student,
  };
  const exportHref = `/staff/requests/export?${new URLSearchParams(
    Object.fromEntries(
      Object.entries(filterQuery).filter((entry): entry is [string, string] =>
        Boolean(entry[1]),
      ),
    ),
  )}`;
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sist-olive-dark text-sm font-semibold">
            Administration portal
          </p>
          <h1 className="text-sist-navy-dark mt-1 text-3xl font-semibold">
            Request queue
          </h1>
          <p className="text-muted-foreground mt-2">
            Review and process document requests using the approved lifecycle.
          </p>
        </div>
        {result.actor.capabilities.includes("EXPORT_REQUEST_DATA") ? (
          <Button asChild variant="outline">
            <a href={exportHref}>Export CSV</a>
          </Button>
        ) : null}
      </header>
      <form
        action="/staff/requests"
        className="bg-staff-panel grid min-w-0 gap-4 rounded-xl border p-5 md:grid-cols-2 xl:grid-cols-5"
        method="get"
      >
        <label className="grid min-w-0 gap-1.5">
          <span className="text-sm font-semibold">Status</span>
          <select
            className="border-input bg-background h-10 min-w-0 rounded-md border px-3"
            defaultValue={result.query.status ?? ""}
            name="status"
          >
            <option value="">All statuses</option>
            {REQUEST_STATUSES.map((status) => (
              <option key={status} value={status}>
                {formatEnumLabel(status)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid min-w-0 gap-1.5">
          <span className="text-sm font-semibold">Category</span>
          <select
            className="border-input bg-background h-10 min-w-0 rounded-md border px-3"
            defaultValue={result.query.categoryId ?? ""}
            name="categoryId"
          >
            <option value="">All categories</option>
            {result.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid min-w-0 gap-1.5">
          <span className="text-sm font-semibold">Reference</span>
          <input
            className="border-input bg-background h-10 min-w-0 rounded-md border px-3"
            defaultValue={result.query.reference}
            maxLength={64}
            name="reference"
          />
        </label>
        <label className="grid min-w-0 gap-1.5">
          <span className="text-sm font-semibold">Student</span>
          <input
            className="border-input bg-background h-10 min-w-0 rounded-md border px-3"
            defaultValue={result.query.student}
            maxLength={100}
            name="student"
            placeholder="Name or student number"
          />
        </label>
        <div className="flex items-end">
          <Button className="w-full" type="submit">
            Apply filters
          </Button>
        </div>
      </form>
      <section
        className="bg-staff-panel overflow-hidden rounded-xl border"
        aria-labelledby="queue-heading"
      >
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold" id="queue-heading">
            Requests
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {result.total} matching request{result.total === 1 ? "" : "s"}.
          </p>
        </div>
        {result.requests.length === 0 ? (
          <p className="p-8 text-center" role="status">
            No requests match the current filters.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-280 text-left text-sm">
              <caption className="sr-only">Document request queue</caption>
              <thead>
                <tr className="border-b">
                  {[
                    "Reference",
                    "Student",
                    "Category",
                    "Status",
                    "Delivery",
                    "Copies",
                    "Submitted",
                    "Updated",
                    "",
                  ].map((label) => (
                    <th
                      className="px-4 py-3 font-semibold"
                      key={label}
                      scope="col"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.requests.map((request) => (
                  <tr className="border-b last:border-0" key={request.id}>
                    <th className="px-4 py-4 font-semibold" scope="row">
                      {request.referenceNumber}
                    </th>
                    <td className="px-4 py-4">
                      <span className="font-medium">
                        {request.student.user.fullName}
                      </span>
                      <br />
                      <span className="text-muted-foreground">
                        {request.student.studentNumber}
                      </span>
                    </td>
                    <td className="px-4 py-4">{request.category.name}</td>
                    <td className="px-4 py-4">
                      <Badge variant="outline">
                        {formatEnumLabel(request.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      {formatEnumLabel(request.deliveryMethod)}
                    </td>
                    <td className="px-4 py-4">{request.copyCount}</td>
                    <td className="px-4 py-4">
                      <time dateTime={request.createdAt.toISOString()}>
                        {dateFormatter.format(request.createdAt)}
                      </time>
                    </td>
                    <td className="px-4 py-4">
                      <time dateTime={request.updatedAt.toISOString()}>
                        {dateFormatter.format(request.updatedAt)}
                      </time>
                    </td>
                    <td className="px-4 py-4">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/staff/requests/${request.id}`}>View</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <nav
        aria-label="Request queue pages"
        className="flex items-center justify-between gap-4"
      >
        <Button
          asChild={result.page > 1}
          disabled={result.page <= 1}
          variant="outline"
        >
          {result.page > 1 ? (
            <Link href={hrefFor(filterQuery, result.page - 1)}>
              Previous page
            </Link>
          ) : (
            <span>Previous page</span>
          )}
        </Button>
        <span className="text-muted-foreground text-sm">
          Page {result.page} of {result.pageCount}
        </span>
        <Button
          asChild={result.page < result.pageCount}
          disabled={result.page >= result.pageCount}
          variant="outline"
        >
          {result.page < result.pageCount ? (
            <Link href={hrefFor(filterQuery, result.page + 1)}>Next page</Link>
          ) : (
            <span>Next page</span>
          )}
        </Button>
      </nav>
    </div>
  );
}
