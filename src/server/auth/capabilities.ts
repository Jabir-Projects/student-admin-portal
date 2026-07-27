import "server-only";

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import type {
  AccountStatusValue,
  CapabilityValue,
  UserRoleValue,
} from "@/features/auth/constants";
import { loadCapabilityActor } from "@/server/auth/capabilities.node";
import { db } from "@/server/db";

export type ActorSessionClaims = {
  actorId: string | undefined;
  claimedSessionVersion: number | undefined;
};

export type CapabilityActor = {
  id: string;
  role: Extract<UserRoleValue, "STAFF" | "ADMIN">;
  status: Extract<AccountStatusValue, "ACTIVE">;
  sessionVersion: number;
  capabilities: readonly CapabilityValue[];
};

export type AuthorizationFailure =
  | "UNAUTHENTICATED"
  | "STALE_SESSION"
  | "INACTIVE_ACCOUNT"
  | "WRONG_ROLE"
  | "MISSING_CAPABILITY";

export type CapabilityAuthorizationResult =
  | { ok: true; actor: CapabilityActor }
  | { ok: false; reason: AuthorizationFailure };

export async function getActorSessionClaims(): Promise<ActorSessionClaims> {
  const session = await auth();
  return {
    actorId: session?.user.id,
    claimedSessionVersion: session?.user.sessionVersion,
  };
}

export async function requireCapability(
  capability: CapabilityValue,
): Promise<CapabilityActor> {
  const result = await loadCapabilityActor(
    await getActorSessionClaims(),
    capability,
    db,
  );
  if (result.ok) return result.actor;
  if (
    result.reason === "UNAUTHENTICATED" ||
    result.reason === "STALE_SESSION" ||
    result.reason === "INACTIVE_ACCOUNT"
  ) {
    redirect("/login");
  }
  redirect("/unauthorized");
}
