import Link from "next/link";
import { CircleAlert, Inbox, Search } from "lucide-react";

import { StaffAccountAction } from "@/components/account-management/staff-account-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { StaffAccountPageQuery } from "@/features/account-management/schemas";
import type {
  CollectionReadResult,
  StaffAccountView,
} from "@/server/account-management/reads.node";

export type StaffAccountSection = {
  kind: "active" | "disabled";
  result: CollectionReadResult<StaffAccountView>;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
});

const sectionContent = {
  active: {
    title: "Active STAFF accounts",
    caption: "Active STAFF accounts available for lifecycle management",
    empty: "No active STAFF accounts match this view.",
  },
  disabled: {
    title: "Disabled STAFF accounts",
    caption: "Disabled STAFF accounts available for reactivation",
    empty: "No disabled STAFF accounts match this view.",
  },
} as const;

function StaffAction({
  kind,
  staff,
}: {
  kind: StaffAccountSection["kind"];
  staff: StaffAccountView;
}) {
  if (staff.isCurrentActor) {
    return (
      <span className="text-muted-foreground text-sm">Current account</span>
    );
  }
  return (
    <StaffAccountAction
      accountReference={staff.accountReference}
      fullName={staff.fullName}
      intent={kind === "active" ? "disable-staff" : "reactivate-staff"}
    />
  );
}

function StaffDetails({
  kind,
  staff,
}: {
  kind: StaffAccountSection["kind"];
  staff: StaffAccountView;
}) {
  const timestamp = kind === "active" ? staff.createdAt : staff.disabledAt;
  return (
    <>
      <div>
        <dt className="text-muted-foreground">Status</dt>
        <dd className="mt-1">
          <Badge variant={kind === "active" ? "success" : "secondary"}>
            {staff.status}
          </Badge>
        </dd>
      </div>
      <div>
        <dt className="text-muted-foreground">
          {kind === "active" ? "Created" : "Disabled"}
        </dt>
        <dd className="mt-1">
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

function StaffSection({ kind, result }: StaffAccountSection) {
  const content = sectionContent[kind];
  if (!result.ok) {
    return (
      <section
        aria-labelledby={`${kind}-staff-heading`}
        className="bg-staff-panel rounded-xl border p-6"
      >
        <CircleAlert aria-hidden="true" className="text-destructive size-7" />
        <h2
          className="text-sist-navy-dark mt-4 text-xl font-semibold"
          id={`${kind}-staff-heading`}
        >
          {content.title} unavailable
        </h2>
        <p className="text-muted-foreground mt-2 leading-7" role="alert">
          This account section could not be loaded safely. Refresh and try
          again.
        </p>
      </section>
    );
  }

  if (result.status === "empty") {
    return (
      <section
        aria-labelledby={`${kind}-staff-heading`}
        className="bg-staff-panel rounded-xl border"
      >
        <div className="border-border border-b px-6 py-5">
          <h2
            className="text-sist-navy-dark text-xl font-semibold"
            id={`${kind}-staff-heading`}
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
      aria-labelledby={`${kind}-staff-heading`}
      className="bg-staff-panel overflow-hidden rounded-xl border"
    >
      <div className="border-border border-b px-6 py-5">
        <h2
          className="text-sist-navy-dark text-xl font-semibold"
          id={`${kind}-staff-heading`}
        >
          {content.title}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {result.data.totalCount} account
          {result.data.totalCount === 1 ? "" : "s"} in this view.
        </p>
      </div>
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full table-fixed text-left text-sm">
          <caption className="sr-only">{content.caption}</caption>
          <thead>
            <tr className="border-border border-b">
              {[
                "STAFF member",
                "Status",
                kind === "active" ? "Created" : "Disabled",
                "Actions",
              ].map((heading) => (
                <th
                  className="px-5 py-3 font-semibold"
                  key={heading}
                  scope="col"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.data.records.map((staff) => {
              const timestamp =
                kind === "active" ? staff.createdAt : staff.disabledAt;
              return (
                <tr
                  className="border-border border-b align-top last:border-b-0"
                  key={staff.accountReference}
                >
                  <th
                    className="px-5 py-4 font-semibold break-words"
                    scope="row"
                  >
                    {staff.fullName}
                  </th>
                  <td className="px-5 py-4">
                    <Badge
                      variant={kind === "active" ? "success" : "secondary"}
                    >
                      {staff.status}
                    </Badge>
                  </td>
                  <td className="px-5 py-4">
                    {timestamp ? (
                      <time dateTime={timestamp.toISOString()}>
                        {dateFormatter.format(timestamp)}
                      </time>
                    ) : (
                      "Not recorded"
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <StaffAction kind={kind} staff={staff} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul className="divide-border divide-y lg:hidden">
        {result.data.records.map((staff) => (
          <li className="space-y-4 p-5" key={staff.accountReference}>
            <p className="font-semibold">{staff.fullName}</p>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <StaffDetails kind={kind} staff={staff} />
            </dl>
            <StaffAction kind={kind} staff={staff} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function queryHref(query: StaffAccountPageQuery, page: number) {
  const parameters = new URLSearchParams();
  if (query.search) parameters.set("search", query.search);
  if (query.status !== "all") parameters.set("status", query.status);
  if (page !== 1) parameters.set("page", String(page));
  if (query.pageSize !== 25) parameters.set("pageSize", String(query.pageSize));
  const suffix = parameters.toString();
  return `/staff/staff-capabilities${suffix ? `?${suffix}` : ""}`;
}

export function StaffAccountManagement({
  query,
  sections,
}: {
  query: StaffAccountPageQuery;
  sections: readonly StaffAccountSection[];
}) {
  const hasNextPage = sections.some(
    ({ result }) =>
      result.ok &&
      result.data.page * result.data.pageSize < result.data.totalCount,
  );

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sist-olive-dark text-sm font-semibold">
          Account management
        </p>
        <h1 className="text-sist-navy-dark mt-1 text-3xl font-semibold tracking-tight">
          STAFF accounts
        </h1>
        <p className="text-muted-foreground mt-2 max-w-3xl leading-7">
          Search existing STAFF accounts and manage their portal access.
        </p>
      </header>

      <form
        action="/staff/staff-capabilities"
        className="bg-staff-panel grid gap-4 rounded-xl border p-5 md:grid-cols-[minmax(0,1fr)_auto_auto_auto]"
        method="get"
      >
        <label className="grid gap-1.5">
          <span className="text-sm font-semibold">Search STAFF</span>
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
              placeholder="Full name"
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
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
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
        <StaffSection key={section.kind} {...section} />
      ))}

      <nav
        aria-label="STAFF account pages"
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
