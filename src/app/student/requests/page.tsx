import Link from "next/link";

import { SystemState } from "@/components/feedback/system-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  formatEnumLabel,
  requestHistoryQuerySchema,
  REQUEST_STATUSES,
} from "@/features/student-portal/schemas";
import { getActorSessionClaims } from "@/server/auth/capabilities";
import { redirectForAuthorizationFailure } from "@/server/auth/session-routing";
import { db } from "@/server/db";
import { listOwnedRequests } from "@/server/student-portal/reads.node";

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);

export default async function StudentRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = requestHistoryQuerySchema.parse(await searchParams);
  const result = await listOwnedRequests(
    await getActorSessionClaims(),
    query,
    db,
  );
  if (!result.ok) redirectForAuthorizationFailure(result.reason);
  const pageHref = (page: number) =>
    `/student/requests?page=${page}${query.status ? `&status=${query.status}` : ""}`;
  return (
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-sm font-medium">
            Student services
          </p>
          <h1 className="text-sist-navy-dark mt-1 text-3xl font-bold">
            My requests
          </h1>
          <p className="text-muted-foreground mt-2">
            Track your administrative requests and their current status.
          </p>
        </div>
        <Button asChild>
          <Link href="/student/requests/new">New request</Link>
        </Button>
      </header>
      <form className="mt-6 flex flex-wrap items-end gap-3" method="get">
        <label className="grid gap-2 text-sm font-medium">
          Status
          <select
            className="bg-background border-input h-11 rounded-md border px-3"
            defaultValue={query.status ?? ""}
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
        <Button type="submit" variant="outline">
          Apply filter
        </Button>
      </form>
      <div className="mt-6">
        {result.requests.length === 0 ? (
          <SystemState
            actionHref={
              query.status ? "/student/requests" : "/student/requests/new"
            }
            actionLabel={query.status ? "Clear filter" : "Submit a request"}
            description={
              query.status
                ? "No requests match the selected status."
                : "You have not submitted any requests yet."
            }
            kind="empty"
            title={query.status ? "No matching requests" : "No requests"}
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[48rem] text-left text-sm">
                  <thead className="bg-muted/60">
                    <tr>
                      <th className="px-5 py-3">Category</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Copies</th>
                      <th className="px-5 py-3">Delivery</th>
                      <th className="px-5 py-3">Submitted</th>
                      <th className="px-5 py-3">
                        <span className="sr-only">Details</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    {result.requests.map((request) => (
                      <tr key={request.id}>
                        <td className="px-5 py-4 font-medium">
                          {request.category.name}
                        </td>
                        <td className="px-5 py-4">
                          <Badge variant="outline">
                            {formatEnumLabel(request.status)}
                          </Badge>
                        </td>
                        <td className="px-5 py-4">{request.copyCount}</td>
                        <td className="px-5 py-4">
                          {formatEnumLabel(request.deliveryMethod)}
                        </td>
                        <td className="px-5 py-4">
                          {formatDate(request.createdAt)}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <Link
                            className="text-primary font-semibold hover:underline"
                            href={`/student/requests/${request.id}`}
                          >
                            View details
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      {result.pageCount > 1 ? (
        <nav
          aria-label="Request history pages"
          className="mt-6 flex items-center justify-between"
        >
          <Button
            asChild={query.page > 1}
            disabled={query.page <= 1}
            variant="outline"
          >
            {query.page > 1 ? (
              <Link href={pageHref(query.page - 1)}>Previous</Link>
            ) : (
              <span>Previous</span>
            )}
          </Button>
          <p className="text-muted-foreground text-sm">
            Page {query.page} of {result.pageCount}
          </p>
          <Button
            asChild={query.page < result.pageCount}
            disabled={query.page >= result.pageCount}
            variant="outline"
          >
            {query.page < result.pageCount ? (
              <Link href={pageHref(query.page + 1)}>Next</Link>
            ) : (
              <span>Next</span>
            )}
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
