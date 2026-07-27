import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type {
  AccountStatusValue,
  CapabilityValue,
  UserRoleValue,
} from "@/features/auth/constants";

export type AuthorizationAuditAction =
  | "ACCOUNT_APPROVED"
  | "ACCOUNT_DISABLED"
  | "ACCOUNT_REACTIVATED"
  | "CAPABILITY_GRANTED"
  | "CAPABILITY_REVOKED"
  | "STAFF_ROLE_CHANGED";

export type TypedAuditEvent = {
  actorId: string;
  action: AuthorizationAuditAction;
  entityType: "User" | "UserCapabilityAssignment";
  entityId: string;
  metadata: Prisma.InputJsonObject;
};

export function accountStatusAuditEvent(input: {
  actorId: string;
  targetUserId: string;
  action: Extract<
    AuthorizationAuditAction,
    "ACCOUNT_APPROVED" | "ACCOUNT_DISABLED" | "ACCOUNT_REACTIVATED"
  >;
  previousStatus: AccountStatusValue;
  newStatus: AccountStatusValue;
}): TypedAuditEvent {
  return {
    actorId: input.actorId,
    action: input.action,
    entityType: "User",
    entityId: input.targetUserId,
    metadata: {
      previousStatus: input.previousStatus,
      newStatus: input.newStatus,
    },
  };
}

export function capabilityAuditEvent(input: {
  actorId: string;
  targetUserId: string;
  action: Extract<
    AuthorizationAuditAction,
    "CAPABILITY_GRANTED" | "CAPABILITY_REVOKED"
  >;
  capability: CapabilityValue;
}): TypedAuditEvent {
  return {
    actorId: input.actorId,
    action: input.action,
    entityType: "UserCapabilityAssignment",
    entityId: `${input.targetUserId}:${input.capability}`,
    metadata: { capability: input.capability },
  };
}

export function staffRoleAuditEvent(input: {
  actorId: string;
  targetUserId: string;
  previousRole: UserRoleValue;
  newRole: UserRoleValue;
  removedCapabilityCount: number;
}): TypedAuditEvent {
  return {
    actorId: input.actorId,
    action: "STAFF_ROLE_CHANGED",
    entityType: "User",
    entityId: input.targetUserId,
    metadata: {
      previousRole: input.previousRole,
      newRole: input.newRole,
      removedCapabilityCount: input.removedCapabilityCount,
    },
  };
}
