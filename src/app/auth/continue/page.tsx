import { redirect } from "next/navigation";
import { getActiveUser } from "@/server/auth/dal";

export default async function ContinuePage() {
  const user = await getActiveUser();
  if (!user) redirect("/login");
  redirect(user.role === "ADMIN" ? "/admin" : "/student");
}
