import { requireActiveUser } from "@/server/auth/dal";

export default async function StudentPage() {
  const user = await requireActiveUser("STUDENT");
  return (
    <section className="bg-card mx-auto max-w-4xl rounded-xl border p-6 shadow-sm sm:p-8">
      <h1 className="text-sist-navy-dark text-3xl font-semibold">
        Student portal
      </h1>
      <p className="text-muted-foreground mt-3">
        Welcome, {user.fullName}. Student services will be introduced in a later
        phase.
      </p>
    </section>
  );
}
