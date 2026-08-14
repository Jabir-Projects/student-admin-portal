import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatEnumLabel } from "@/features/student-portal/schemas";
import { getStaffIdentityLabel } from "@/features/staff/identity";
import { requireStaffShellUser } from "@/server/auth/dal";

export default async function StaffProfilePage() {
  const user = await requireStaffShellUser();
  const staffLabel = getStaffIdentityLabel(user.capabilities);
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <p className="text-muted-foreground text-sm font-medium">
          Staff portal
        </p>
        <h1 className="text-sist-navy-dark mt-1 text-3xl font-bold tracking-tight">
          My profile
        </h1>
        <p className="text-muted-foreground mt-2">
          Your account information and assigned responsibilities.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Account information</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-5 sm:grid-cols-2">
            {[
              ["Full name", user.fullName],
              ["Email", user.email],
              ["Staff type", staffLabel],
              ["Account status", formatEnumLabel(user.status)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-muted-foreground text-sm">{label}</dt>
                <dd className="mt-1 font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Assigned capabilities</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            {user.capabilities.length}{" "}
            {user.capabilities.length === 1 ? "capability" : "capabilities"}{" "}
            currently assigned to your account.
          </p>
          {user.capabilities.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-2">
              {user.capabilities.map((capability) => (
                <li key={capability}>
                  <Badge variant="secondary">
                    {formatEnumLabel(capability)}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground mt-4 text-sm">
              No administrative capabilities have been assigned yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
