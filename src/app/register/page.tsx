import { registerAction } from "@/app/register/actions";
import { AuthPanel, AuthShell } from "@/components/layout/auth-shell";
import { RegistrationForm } from "@/app/register/registration-form";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <AuthShell size="lg">
      <AuthPanel
        description="Submit your details for administrative review. Registration does not verify your Student Number institutionally."
        title="Student account registration"
      >
        <RegistrationForm action={registerAction} error={error} />
      </AuthPanel>
    </AuthShell>
  );
}
