import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import type { CapabilityValue } from "@/features/auth/constants";
import type {
  ActorSessionClaims,
  CapabilityAuthorizationResult,
} from "@/server/auth/capabilities";
import { loadCapabilityActor } from "@/server/auth/capabilities.node";

export async function loadAnyCapabilityActor(
  claims: ActorSessionClaims,
  capabilities: readonly CapabilityValue[],
  database: PrismaClient,
): Promise<CapabilityAuthorizationResult> {
  let missing: CapabilityAuthorizationResult = {
    ok: false,
    reason: "MISSING_CAPABILITY",
  };
  for (const capability of capabilities) {
    const result = await loadCapabilityActor(claims, capability, database);
    if (result.ok) return result;
    if (result.reason !== "MISSING_CAPABILITY") return result;
    missing = result;
  }
  return missing;
}
