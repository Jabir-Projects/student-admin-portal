import Link from "next/link";
import { requireActiveUser } from "@/server/auth/dal";
import { LogoutButton } from "@/components/auth/logout-button";

export default async function AdminPage() {
  await requireActiveUser(["STAFF", "ADMIN"]);
  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Administration</h1>
        <LogoutButton />
      </div>
      <p className="text-muted-foreground mt-3">
        Phase 3 account administration.
      </p>
      <Link
        className="text-primary mt-6 inline-block font-medium hover:underline"
        href="/admin/users/pending"
      >
        Review pending student accounts
      </Link>
    </main>
  );
}
