import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getActorSessionClaims } from "@/server/auth/capabilities";
import { redirectForAuthorizationFailure } from "@/server/auth/session-routing";
import { db } from "@/server/db";
import { listAuditLog } from "@/server/notifications/reads.node";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
});

function pageHref(
  query: Record<string, string | string[] | undefined>,
  page: number,
) {
  const params = new URLSearchParams();
  for (const key of [
    "action",
    "entityType",
    "actor",
    "dateFrom",
    "dateTo",
    "pageSize",
  ] as const) {
    const value = query[key];
    if (typeof value === "string" && value) params.set(key, value);
  }
  params.set("page", String(page));
  return `/staff/audit?${params.toString()}`;
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const result = await listAuditLog(await getActorSessionClaims(), raw, db);
  if (!result.ok) {
    if (result.reason !== "INVALID_INPUT")
      redirectForAuthorizationFailure(result.reason);
    return <p role="alert">The audit filters are invalid.</p>;
  }
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sist-green text-sm font-semibold tracking-[0.18em] uppercase">
          Administration
        </p>
        <h1 className="text-sist-navy-dark mt-2 text-3xl font-bold">
          Audit log
        </h1>
        <p className="text-muted-foreground mt-2">
          Append-only attributable events with sanitized metadata.
        </p>
      </header>
      <form
        action="/staff/audit"
        className="bg-card grid min-w-0 gap-4 rounded-xl border p-5 md:grid-cols-2 xl:grid-cols-6"
      >
        <label className="grid min-w-0 gap-1.5">
          <span className="text-sm font-semibold">Action</span>
          <select
            className="border-input bg-background h-10 min-w-0 rounded-md border px-3"
            defaultValue={result.query.action ?? ""}
            name="action"
          >
            <option value="">All actions</option>
            {result.actions.map((action) => (
              <option key={action}>{action}</option>
            ))}
          </select>
        </label>
        <label className="grid min-w-0 gap-1.5">
          <span className="text-sm font-semibold">Entity type</span>
          <select
            className="border-input bg-background h-10 min-w-0 rounded-md border px-3"
            defaultValue={result.query.entityType ?? ""}
            name="entityType"
          >
            <option value="">All entities</option>
            {result.entityTypes.map((entity) => (
              <option key={entity}>{entity}</option>
            ))}
          </select>
        </label>
        <label className="grid min-w-0 gap-1.5">
          <span className="text-sm font-semibold">Actor</span>
          <input
            className="border-input bg-background h-10 min-w-0 rounded-md border px-3"
            defaultValue={result.query.actor ?? ""}
            maxLength={100}
            name="actor"
          />
        </label>
        <label className="grid min-w-0 gap-1.5">
          <span className="text-sm font-semibold">From</span>
          <input
            className="border-input bg-background h-10 min-w-0 rounded-md border px-3"
            defaultValue={result.query.dateFrom ?? ""}
            name="dateFrom"
            type="date"
          />
        </label>
        <label className="grid min-w-0 gap-1.5">
          <span className="text-sm font-semibold">To</span>
          <input
            className="border-input bg-background h-10 min-w-0 rounded-md border px-3"
            defaultValue={result.query.dateTo ?? ""}
            name="dateTo"
            type="date"
          />
        </label>
        <div className="flex items-end">
          <Button className="w-full" type="submit">
            Apply filters
          </Button>
        </div>
      </form>
      <section
        aria-labelledby="audit-events-heading"
        className="bg-card overflow-hidden rounded-xl border"
      >
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold" id="audit-events-heading">
            Audit events
          </h2>
          <p className="text-muted-foreground text-sm">
            {result.total} matching events.
          </p>
        </div>
        {result.rows.length === 0 ? (
          <p className="p-8 text-center text-sm">
            No audit events match these filters.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-180 text-left text-sm">
              <caption className="sr-only">Sanitized audit events</caption>
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Approved metadata</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr className="border-t align-top" key={row.id}>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <time dateTime={row.createdAt.toISOString()}>
                        {dateFormatter.format(row.createdAt)}
                      </time>
                    </td>
                    <td className="px-4 py-4 font-medium">{row.action}</td>
                    <td className="px-4 py-4">{row.entityType}</td>
                    <td className="px-4 py-4">
                      {row.actor?.fullName ?? "System"}
                    </td>
                    <td className="px-4 py-4">
                      {row.metadata.length === 0 ? (
                        <span className="text-muted-foreground">
                          No displayable metadata
                        </span>
                      ) : (
                        <dl className="space-y-1">
                          {row.metadata.map((item) => (
                            <div className="flex gap-2" key={item.label}>
                              <dt className="font-medium">{item.label}:</dt>
                              <dd>{item.value}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <nav
        aria-label="Audit pages"
        className="flex items-center justify-between gap-4"
      >
        <Button
          asChild={result.page > 1}
          disabled={result.page <= 1}
          variant="outline"
        >
          {result.page > 1 ? (
            <Link href={pageHref(raw, result.page - 1)}>Previous</Link>
          ) : (
            <span>Previous</span>
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
            <Link href={pageHref(raw, result.page + 1)}>Next</Link>
          ) : (
            <span>Next</span>
          )}
        </Button>
      </nav>
    </div>
  );
}
