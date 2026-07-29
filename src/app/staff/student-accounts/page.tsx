import { redirect } from "next/navigation";
import { TriangleAlert } from "lucide-react";

import {
  StudentAccountManagement,
  type StudentAccountSection,
} from "@/components/account-management/student-account-management";
import { studentAccountPageQuerySchema } from "@/features/account-management/schemas";
import type { AuthorizationPresentationFailure } from "@/features/auth/session-ux";
import {
  authorizeAccountManagementPage,
  getDisabledStudentAccounts,
  getManagedStudentAccounts,
} from "@/server/account-management/reads";
import { redirectForAuthorizationFailure } from "@/server/auth/session-routing";

type StudentAccountSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

function redirectDeniedSection(
  sections: readonly StudentAccountSection[],
): void {
  const denied = sections.find(
    ({ result }) => !result.ok && result.status === "denied",
  );
  if (denied && !denied.result.ok && denied.result.status === "denied") {
    redirectForAuthorizationFailure(
      denied.result.reason as AuthorizationPresentationFailure,
    );
  }
}

export default async function StudentAccountsPage({
  searchParams,
}: {
  searchParams: StudentAccountSearchParams;
}) {
  const entry = await authorizeAccountManagementPage("student-accounts");
  if (!entry.ok) redirectForAuthorizationFailure(entry.reason);

  const parsedQuery = studentAccountPageQuerySchema.safeParse(
    await searchParams,
  );
  if (!parsedQuery.success) {
    return (
      <section className="bg-staff-panel rounded-xl border p-6" role="alert">
        <TriangleAlert aria-hidden="true" className="text-destructive size-7" />
        <h1 className="text-sist-navy-dark mt-4 text-2xl font-semibold">
          Invalid student account filters
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl leading-7">
          The requested search or page values are not valid. Return to the
          student account page and try again.
        </p>
        <a
          className="text-primary mt-5 inline-flex font-semibold hover:underline"
          href="/staff/student-accounts"
        >
          Clear filters
        </a>
      </section>
    );
  }

  const query = parsedQuery.data;
  const canManage = entry.actor.capabilities.includes(
    "MANAGE_STUDENT_ACCOUNTS",
  );
  const canReactivate = entry.actor.capabilities.includes(
    "REACTIVATE_STUDENT_ACCOUNTS",
  );
  const selectedCapabilityIsMissing =
    ((query.status === "pending" || query.status === "active") && !canManage) ||
    (query.status === "disabled" && !canReactivate);
  if (selectedCapabilityIsMissing) redirect("/unauthorized");

  const sectionPromises: Array<Promise<StudentAccountSection>> = [];
  if (canManage && (query.status === "all" || query.status === "pending")) {
    sectionPromises.push(
      getManagedStudentAccounts({
        search: query.search,
        page: query.page,
        pageSize: query.pageSize,
        status: "PENDING_APPROVAL",
      }).then((result) => ({ kind: "pending", result })),
    );
  }
  if (canManage && (query.status === "all" || query.status === "active")) {
    sectionPromises.push(
      getManagedStudentAccounts({
        search: query.search,
        page: query.page,
        pageSize: query.pageSize,
        status: "ACTIVE",
      }).then((result) => ({ kind: "active", result })),
    );
  }
  if (
    canReactivate &&
    (query.status === "all" || query.status === "disabled")
  ) {
    sectionPromises.push(
      getDisabledStudentAccounts({
        search: query.search,
        page: query.page,
        pageSize: query.pageSize,
      }).then((result) => ({ kind: "disabled", result })),
    );
  }

  const sections = await Promise.all(sectionPromises);
  redirectDeniedSection(sections);

  return (
    <StudentAccountManagement
      canManage={canManage}
      canReactivate={canReactivate}
      query={query}
      sections={sections}
    />
  );
}
