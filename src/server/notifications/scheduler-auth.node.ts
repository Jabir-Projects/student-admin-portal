import "server-only";

import { timingSafeEqual } from "node:crypto";

export function hasAuthorizedSchedulerSecret(
  authorization: string | null,
  secret: string | undefined,
): boolean {
  if (!secret || secret.length < 32 || !authorization?.startsWith("Bearer "))
    return false;
  const expected = Buffer.from(secret);
  const actual = Buffer.from(authorization.slice("Bearer ".length));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
