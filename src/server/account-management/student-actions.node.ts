import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { studentAccountActionInputSchema } from "@/features/account-management/schemas";
import {
  resolveAccountReference,
  type AccountReferenceResolution,
} from "@/server/account-management/account-reference.node";
import { authorizePackageDRead } from "@/server/account-management/authorization.node";
import {
  approvePendingStudentAsActor,
  disableStudentAsActor,
  reactivateDisabledStudentAsActor,
  type AccountTransitionResult,
} from "@/server/auth/account-management.node";
import type { ActorSessionClaims } from "@/server/auth/capabilities";

export type StudentAccountActionState = {
  status: "idle" | "success" | "validation-error" | "denied" | "error";
  message: string;
};

type StudentMutationIntent =
  "approve-student" | "disable-student" | "reactivate-student";

type StudentActionDependencies = {
  authorize: typeof authorizePackageDRead;
  resolveReference: (
    reference: string,
    purpose: "student",
    secret: string,
  ) => AccountReferenceResolution;
  mutate: Record<
    StudentMutationIntent,
    (
      claims: ActorSessionClaims,
      accountId: string,
      database: PrismaClient,
    ) => Promise<AccountTransitionResult>
  >;
};

const defaultDependencies: StudentActionDependencies = {
  authorize: authorizePackageDRead,
  resolveReference: resolveAccountReference,
  mutate: {
    "approve-student": approvePendingStudentAsActor,
    "disable-student": disableStudentAsActor,
    "reactivate-student": reactivateDisabledStudentAsActor,
  },
};

const requiredCapability = {
  "approve-student": "MANAGE_STUDENT_ACCOUNTS",
  "disable-student": "MANAGE_STUDENT_ACCOUNTS",
  "reactivate-student": "REACTIVATE_STUDENT_ACCOUNTS",
} as const;

const successMessage = {
  "approve-student": "The student account was approved.",
  "disable-student": "The student account was disabled.",
  "reactivate-student": "The student account was reactivated.",
} as const;

export async function executeStudentAccountAction(
  claims: ActorSessionClaims,
  input: unknown,
  database: PrismaClient,
  referenceSecret: string,
  dependencies: StudentActionDependencies = defaultDependencies,
): Promise<StudentAccountActionState> {
  const parsed = studentAccountActionInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "validation-error",
      message: "The submitted account action is invalid. Refresh and retry.",
    };
  }

  try {
    const resolved = dependencies.resolveReference(
      parsed.data.accountReference,
      "student",
      referenceSecret,
    );
    if (!resolved.ok) {
      return {
        status: "validation-error",
        message: "The submitted account action is invalid. Refresh and retry.",
      };
    }

    const authorization = await dependencies.authorize(
      claims,
      requiredCapability[parsed.data.intent],
      database,
    );
    if (!authorization.ok) {
      return {
        status: "denied",
        message: "You are not authorized to perform this account action.",
      };
    }

    const result = await dependencies.mutate[parsed.data.intent](
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
