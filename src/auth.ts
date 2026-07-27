import "server-only";

import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { authConfig } from "@/auth.config";
import { loginSchema } from "@/features/auth/schemas";
import { db } from "@/server/db";
import { getAuthenticationSecret } from "@/server/auth/env";
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
        const parsed = loginSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const user = await db.user.findUnique({
          where: { email: parsed.data.email },
          select: {
            id: true,
            passwordHash: true,
            role: true,
            status: true,
            sessionVersion: true,
          },
        });

        if (!user) {
          await performComparablePasswordWork(parsed.data.password);
          return null;
        }

        const passwordIsValid = await verifyPassword(
          user.passwordHash,
          parsed.data.password,
        );
        if (!passwordIsValid) return null;
        if (user.status === "PENDING_APPROVAL")
          throw new PendingApprovalError();
        if (user.status === "DISABLED") throw new DisabledAccountError();

        await db.auditLog.create({
          data: {
            actorId: user.id,
            action: "AUTHENTICATION_SUCCEEDED",
            entityType: "User",
            entityId: user.id,
            metadata: { method: "credentials" },
          },
        });

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
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      try {
        return new URL(url).origin === baseUrl
          ? url
          : `${baseUrl}/auth/continue`;
      } catch {
        return `${baseUrl}/auth/continue`;
      }
    },
  },
});
