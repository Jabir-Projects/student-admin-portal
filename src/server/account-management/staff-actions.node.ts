import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { staffAccountActionInputSchema } from "@/features/account-management/schemas";
import {
  resolveAccountReference,
  type AccountReferenceResolution,
} from "@/server/account-management/account-reference.node";
import { authorizePackageDRead } from "@/server/account-management/authorization.node";
import {
  createStaffAccountAsActor,
  disableStaffAccountAsActor,
  grantCapabilityAsActor,
  reactivateStaffAccountAsActor,
  revokeCapabilityAsActor,
  type CapabilityMutationResult,
  type CreateStaffAccountResult,
} from "@/server/auth/capabilities.node";
import type { ActorSessionClaims } from "@/server/auth/capabilities";
import { hashPassword } from "@/server/auth/password.node";

export type StaffAccountActionState = {
  status: "idle" | "success" | "validation-error" | "denied" | "error";
  message: string;
};

type StaffMutationIntent = "disable-staff" | "reactivate-staff";
type CapabilityMutationIntent = "grant-capability" | "revoke-capability";

type StaffActionDependencies = {
  authorize: typeof authorizePackageDRead;
  resolveReference: (
    reference: string,
    purpose: "staff",
    secret: string,
  ) => AccountReferenceResolution;
  mutate: Record<
    StaffMutationIntent,
    (
      claims: ActorSessionClaims,
      accountId: string,
      database: PrismaClient,
    ) => Promise<CapabilityMutationResult>
  >;
  mutateCapability: Record<
    CapabilityMutationIntent,
    typeof grantCapabilityAsActor
  >;
  create: typeof createStaffAccountAsActor;
  hashPassword: typeof hashPassword;
};

const defaultDependencies: StaffActionDependencies = {
  authorize: authorizePackageDRead,
  resolveReference: resolveAccountReference,
  mutate: {
    "disable-staff": disableStaffAccountAsActor,
    "reactivate-staff": reactivateStaffAccountAsActor,
  },
  mutateCapability: {
    "grant-capability": grantCapabilityAsActor,
    "revoke-capability": revokeCapabilityAsActor,
  },
  create: createStaffAccountAsActor,
  hashPassword,
};

const successMessage = {
  "disable-staff": "The STAFF account was disabled.",
  "reactivate-staff": "The STAFF account was reactivated.",
  "grant-capability": "The capability was assigned.",
  "revoke-capability": "The capability was removed.",
  "create-staff": "The STAFF account was created.",
} as const;

export async function executeStaffAccountAction(
  claims: ActorSessionClaims,
  input: unknown,
  database: PrismaClient,
  referenceSecret: string,
  dependencies: StaffActionDependencies = defaultDependencies,
): Promise<StaffAccountActionState> {
  const parsed = staffAccountActionInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "validation-error",
      message: "The submitted account action is invalid. Refresh and retry.",
    };
  }

  try {
    if (parsed.data.intent === "create-staff") {
      const authorization = await dependencies.authorize(
        claims,
        "MANAGE_STAFF_ACCOUNTS",
        database,
      );
      if (!authorization.ok) {
        return {
          status: "denied",
          message: "You are not authorized to perform this account action.",
        };
      }
      if (
        parsed.data.capabilities.length > 0 &&
        !authorization.actor.capabilities.includes("MANAGE_STAFF_CAPABILITIES")
      ) {
        return {
          status: "denied",
          message: "You are not authorized to assign STAFF capabilities.",
        };
      }
      const result: CreateStaffAccountResult = await dependencies.create(
        claims,
        {
          email: parsed.data.email,
          fullName: parsed.data.fullName,
          passwordHash: await dependencies.hashPassword(parsed.data.password),
          capabilities: [...new Set(parsed.data.capabilities)],
        },
        database,
      );
      return result.ok
        ? { status: "success", message: successMessage["create-staff"] }
        : {
            status: "error",
            message:
              "The STAFF account could not be created. Check the details and retry.",
          };
    }

    const resolved = dependencies.resolveReference(
      parsed.data.accountReference,
      "staff",
      referenceSecret,
    );
    if (!resolved.ok) {
      return {
        status: "validation-error",
        message: "The submitted account action is invalid. Refresh and retry.",
      };
    }

    const requiredCapability =
      parsed.data.intent === "grant-capability" ||
      parsed.data.intent === "revoke-capability"
        ? "MANAGE_STAFF_CAPABILITIES"
        : "MANAGE_STAFF_ACCOUNTS";
    const authorization = await dependencies.authorize(
      claims,
      requiredCapability,
      database,
    );
    if (!authorization.ok) {
      return {
        status: "denied",
        message: "You are not authorized to perform this account action.",
      };
    }

    const result: CapabilityMutationResult =
      parsed.data.intent === "grant-capability" ||
      parsed.data.intent === "revoke-capability"
        ? await dependencies.mutateCapability[parsed.data.intent](
            claims,
            resolved.accountId,
            parsed.data.capability,
            database,
          )
        : await dependencies.mutate[parsed.data.intent](
            claims,
            resolved.accountId,
            database,
          );
    return result.ok
      ? {
          status: "success",
          message: successMessage[parsed.data.intent],
        }
      : {
          status: "error",
          message:
            "The account action could not be completed. Refresh and retry.",
        };
  } catch {
    return {
      status: "error",
      message: "The account action could not be completed. Refresh and retry.",
    };
  }
}
