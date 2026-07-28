import { redirect } from "next/navigation";
import { getPostAuthenticationPath } from "@/auth.config";
import { requireActiveUser } from "@/server/auth/dal";

export default async function ContinuePage() {
  const user = await requireActiveUser(["STUDENT", "STAFF", "ADMIN"]);
  redirect(getPostAuthenticationPath(user.role));
}
