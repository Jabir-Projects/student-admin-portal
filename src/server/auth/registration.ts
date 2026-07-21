import "server-only";

import {
  type RegistrationResult,
  registerStudentWithDatabase,
} from "@/server/auth/registration.node";
import { db } from "@/server/db";

export type { RegistrationResult };

export async function registerStudent(
  rawInput: unknown,
): Promise<RegistrationResult> {
  return registerStudentWithDatabase(rawInput, db);
}
