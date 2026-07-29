import "server-only";

import { z } from "zod";

import type { PrismaClient } from "@/generated/prisma/client";
import { accountReferenceSchema } from "@/features/account-management/schemas";
import {
  resolveAccountReference,
  type AccountReferenceResolution,
} from "@/server/account-management/account-reference.node";
import {
  approvePendingStudentAsActor,
  disableStudentAsActor,
  type AccountTransitionResult,
} from "@/server/auth/account-management.node";
import type {
  ActorSessionClaims,
  CapabilityAuthorizationResult,
} from "@/server/auth/capabilities";
import { loadCapabilityActor } from "@/server/auth/capabilities.node";

const legacyAdminStudentActionInputSchema = z
  .object({
    intent: z.enum(["approve-student", "disable-student"]),
    accountReference: accountReferenceSchema,
  })
  .strict();

export type LegacyAdminStudentActionState = {
  status: "success" | "validation-error" | "denied" | "error";
  message: string;
};

type LegacyAdminStudentIntent = z.infer<
  typeof legacyAdminStudentActionInputSchema
>["intent"];

type LegacyAdminStudentActionDependencies = {
  authorize: (
    claims: ActorSessionClaims,
    capability: "MANAGE_STUDENT_ACCOUNTS",
    database: PrismaClient,
  ) => Promise<CapabilityAuthorizationResult>;
  resolveReference: (
    reference: string,
    purpose: "student",
    secret: string,
  ) => AccountReferenceResolution;
  mutate: Record<
    LegacyAdminStudentIntent,
    (
      claims: ActorSessionClaims,
      accountId: string,
      database: PrismaClient,
      actorMode: "ADMIN_ONLY",
    ) => Promise<AccountTransitionResult>
  >;
};

const defaultDependencies: LegacyAdminStudentActionDependencies = {
  authorize: loadCapabilityActor,
  resolveReference: resolveAccountReference,
  mutate: {
    "approve-student": approvePendingStudentAsActor,
    "disable-student": disableStudentAsActor,
  },
};

const successMessage = {
  "approve-student": "The student account was approved.",
  "disable-student": "The student account was disabled.",
} as const;

const invalidAction: LegacyAdminStudentActionState = {
  status: "validation-error",
  message: "The submitted account action is invalid. Refresh and retry.",
};
const deniedAction: LegacyAdminStudentActionState = {
  status: "denied",
  message: "You are not authorized to perform this account action.",
};
const failedAction: LegacyAdminStudentActionState = {
  status: "error",
  message: "The account action could not be completed. Refresh and retry.",
};

export async function executeLegacyAdminStudentAction(
  claims: ActorSessionClaims,
  input: unknown,
  database: PrismaClient,
  referenceSecret: string,
  dependencies: LegacyAdminStudentActionDependencies = defaultDependencies,
): Promise<LegacyAdminStudentActionState> {
  const parsed = legacyAdminStudentActionInputSchema.safeParse(input);
  if (!parsed.success) return invalidAction;

  try {
    const resolved = dependencies.resolveReference(
      parsed.data.accountReference,
      "student",
      referenceSecret,
    );
    if (!resolved.ok) return invalidAction;

    const authorization = await dependencies.authorize(
      claims,
      "MANAGE_STUDENT_ACCOUNTS",
      database,
    );
    if (!authorization.ok || authorization.actor.role !== "ADMIN") {
      return deniedAction;
    }

    const result = await dependencies.mutate[parsed.data.intent](
      claims,
      resolved.accountId,
      database,
      "ADMIN_ONLY",
    );
    return result.ok
      ? {
          status: "success",
          message: successMessage[parsed.data.intent],
        }
      : failedAction;
  } catch {
    return failedAction;
  }
}
