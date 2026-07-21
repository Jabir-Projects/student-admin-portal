import { requireActiveUser } from "@/server/auth/dal";
import { LogoutButton } from "@/components/auth/logout-button";

export default async function StudentPage() {
  const user = await requireActiveUser("STUDENT");
  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Student portal</h1>
        <LogoutButton />
      </div>
      <p className="text-muted-foreground mt-3">
        Welcome, {user.fullName}. Student services will be introduced in a later
        phase.
      </p>
    </main>
  );
}
