import "server-only";

import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { authConfig, getSafeCallbackUrl } from "@/auth.config";
import { loginSchema } from "@/features/auth/schemas";
import { db } from "@/server/db";
import { getAuthenticationSecret } from "@/server/auth/env";
import { emitAuthenticationDiagnostic } from "@/server/auth/diagnostics";
import {
  performComparablePasswordWork,
  verifyPassword,
} from "@/server/auth/password";

class PendingApprovalError extends CredentialsSignin {
  code = "pending_approval";
}

class DisabledAccountError extends CredentialsSignin {
  code = "account_disabled";
}

const authSecret = getAuthenticationSecret(process.env, {
  allowMissing:
    process.env.NODE_ENV === "test" ||
    process.env.NEXT_PHASE === "phase-production-build",
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  secret: authSecret,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(rawCredentials) {
        emitAuthenticationDiagnostic("authorize_entered");
        const parsed = loginSchema.safeParse({
          email: rawCredentials?.email,
          password: rawCredentials?.password,
        });
        if (!parsed.success) {
          emitAuthenticationDiagnostic("authorize_schema_invalid");
          return null;
        }
        emitAuthenticationDiagnostic("authorize_schema_valid");

        let user;
        try {
          user = await db.user.findUnique({
            where: { email: parsed.data.email },
            select: {
              id: true,
              passwordHash: true,
              role: true,
              status: true,
              sessionVersion: true,
            },
          });
          emitAuthenticationDiagnostic("authorize_user_lookup_completed");
        } catch (error) {
          emitAuthenticationDiagnostic("authorize_user_lookup_failed");
          throw error;
        }

        if (!user) {
          emitAuthenticationDiagnostic("authorize_user_not_found");
          await performComparablePasswordWork(parsed.data.password);
          return null;
        }
        emitAuthenticationDiagnostic("authorize_user_found");

        emitAuthenticationDiagnostic("authorize_password_check_started");
        const passwordIsValid = await verifyPassword(
          user.passwordHash,
          parsed.data.password,
        );
        if (!passwordIsValid) {
          emitAuthenticationDiagnostic("authorize_password_invalid");
          return null;
        }
        emitAuthenticationDiagnostic("authorize_password_valid");
        if (user.status === "PENDING_APPROVAL") {
          emitAuthenticationDiagnostic("authorize_pending_approval");
          throw new PendingApprovalError();
        }
        if (user.status === "DISABLED") {
          emitAuthenticationDiagnostic("authorize_disabled");
          throw new DisabledAccountError();
        }
        emitAuthenticationDiagnostic("authorize_active_user");

        try {
          await db.auditLog.create({
            data: {
              actorId: user.id,
              action: "AUTHENTICATION_SUCCEEDED",
              entityType: "User",
              entityId: user.id,
              metadata: { method: "credentials" },
            },
          });
          emitAuthenticationDiagnostic("authorize_audit_written");
        } catch (error) {
          emitAuthenticationDiagnostic("authorize_audit_failed");
          throw error;
        }

        return {
          id: user.id,
          role: user.role,
          status: user.status,
          sessionVersion: user.sessionVersion,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    redirect({ url, baseUrl }) {
      return getSafeCallbackUrl(url, baseUrl);
    },
  },
});
