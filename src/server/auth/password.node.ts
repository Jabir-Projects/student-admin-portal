import { argon2id, hash, verify } from "argon2";

import { emitAuthenticationDiagnostic } from "@/server/auth/diagnostics";

const PASSWORD_MAX_LENGTH = 128;
const ARGON2_OPTIONS = {
  type: argon2id,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1,
  hashLength: 32,
} as const;

function assertBoundedPassword(password: string): void {
  if (password.length === 0 || password.length > PASSWORD_MAX_LENGTH) {
    throw new Error("Password length is outside the supported range.");
  }
}

export async function hashPassword(password: string): Promise<string> {
  assertBoundedPassword(password);
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  assertBoundedPassword(password);
  try {
    const passwordIsValid = await verify(passwordHash, password);
    if (!passwordIsValid) {
      emitAuthenticationDiagnostic("password_verify_false");
    }
    return passwordIsValid;
  } catch {
    emitAuthenticationDiagnostic("password_verify_exception");
    return false;
  }
}

export async function performComparablePasswordWork(
  password: string,
): Promise<void> {
  await hashPassword(password);
}
