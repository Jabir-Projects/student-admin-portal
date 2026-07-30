import {
  StaffAccountManagement,
  type StaffAccountSection,
} from "@/components/account-management/staff-account-management";
import { StaffCapabilityManagement } from "@/components/account-management/staff-capability-management";
import { StaffCreateForm } from "@/components/account-management/staff-create-form";
import { staffAccountPageQuerySchema } from "@/features/account-management/schemas";
import type { AuthorizationPresentationFailure } from "@/features/auth/session-ux";
import {
  authorizeAccountManagementPage,
  getStaffCapabilityAssignments,
  getStaffInventory,
} from "@/server/account-management/reads";
import { redirectForAuthorizationFailure } from "@/server/auth/session-routing";
import { TriangleAlert } from "lucide-react";

type StaffAccountSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

function redirectDeniedSection(sections: readonly StaffAccountSection[]): void {
  const denied = sections.find(
    ({ result }) => !result.ok && result.status === "denied",
  );
  if (denied && !denied.result.ok && denied.result.status === "denied") {
    redirectForAuthorizationFailure(
      denied.result.reason as AuthorizationPresentationFailure,
    );
  }
}

export default async function StaffCapabilitiesPage({
  searchParams,
}: {
  searchParams: StaffAccountSearchParams;
}) {
  const entry = await authorizeAccountManagementPage("staff-management");
  if (!entry.ok) redirectForAuthorizationFailure(entry.reason);
  const canManageAccounts = entry.actor.capabilities.includes(
    "MANAGE_STAFF_ACCOUNTS",
  );
  const canManageCapabilities = entry.actor.capabilities.includes(
    "MANAGE_STAFF_CAPABILITIES",
  );
  if (!canManageAccounts && !canManageCapabilities) {
    redirectForAuthorizationFailure("MISSING_CAPABILITY");
  }

  const parsedQuery = staffAccountPageQuerySchema.safeParse(await searchParams);
  if (!parsedQuery.success) {
    return (
      <section className="bg-staff-panel rounded-xl border p-6" role="alert">
        <TriangleAlert aria-hidden="true" className="text-destructive size-7" />
        <h1 className="text-sist-navy-dark mt-4 text-2xl font-semibold">
          Invalid STAFF account filters
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl leading-7">
          The requested search or page values are not valid. Return to the STAFF
          account page and try again.
        </p>
        <a
          className="text-primary mt-5 inline-flex font-semibold hover:underline"
          href="/staff/staff-capabilities"
        >
          Clear filters
        </a>
      </section>
    );
  }

  const query = parsedQuery.data;
  const sectionPromises: Array<Promise<StaffAccountSection>> = [];
  if (
    canManageAccounts &&
    (query.status === "all" || query.status === "active")
  ) {
    sectionPromises.push(
      getStaffInventory({
        search: query.search,
        page: query.page,
        pageSize: query.pageSize,
        status: "ACTIVE",
      }).then((result) => ({ kind: "active", result })),
    );
  }
  if (
    canManageAccounts &&
    (query.status === "all" || query.status === "disabled")
  ) {
    sectionPromises.push(
      getStaffInventory({
        search: query.search,
        page: query.page,
        pageSize: query.pageSize,
        status: "DISABLED",
      }).then((result) => ({ kind: "disabled", result })),
    );
  }

  const sections = await Promise.all(sectionPromises);
  redirectDeniedSection(sections);

  const capabilityResult = canManageCapabilities
    ? await getStaffCapabilityAssignments({
        search: query.search,
        page: query.page,
        pageSize: query.pageSize,
        status:
          query.status === "active"
            ? "ACTIVE"
            : query.status === "disabled"
              ? "DISABLED"
              : undefined,
      })
    : null;
  if (
    capabilityResult &&
    !capabilityResult.ok &&
    capabilityResult.status === "denied"
  ) {
    redirectForAuthorizationFailure(capabilityResult.reason);
  }

  return (
    <div className="space-y-6">
      {canManageAccounts ? (
        <StaffAccountManagement query={query} sections={sections} />
      ) : (
        <header>
          <p className="text-sist-olive-dark text-sm font-semibold">
            Account management
          </p>
          <h1 className="text-sist-navy-dark mt-1 text-3xl font-semibold tracking-tight">
            STAFF capabilities
          </h1>
          <p className="text-muted-foreground mt-2 max-w-3xl leading-7">
            Review and update the approved capability assignments for STAFF
            accounts.
          </p>
        </header>
      )}
      {canManageAccounts ? (
        <StaffCreateForm canAssignCapabilities={canManageCapabilities} />
      ) : null}
      {capabilityResult ? (
        <StaffCapabilityManagement result={capabilityResult} />
      ) : null}
    </div>
  );
}
