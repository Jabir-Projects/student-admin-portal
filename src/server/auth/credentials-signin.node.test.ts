// @vitest-environment node

import { Auth, raw, skipCSRFCheck } from "@auth/core";
import { CredentialsSignin } from "@auth/core/errors";
import Credentials from "next-auth/providers/credentials";
import { describe, expect, it } from "vitest";

class PendingApprovalError extends CredentialsSignin {
  code = "pending_approval";
}

function credentialsCallbackRequest() {
  return new Request(
    "https://portal.sist.example/api/auth/callback/credentials",
    {
      body: new URLSearchParams(),
      headers: { "content-type": "application/x-www-form-urlencoded" },
      method: "POST",
    },
  );
}

describe("Auth.js CredentialsSignin propagation", () => {
  it("rethrows a custom CredentialsSignin code in raw server-action mode", async () => {
    const provider = Credentials({
      credentials: {},
      authorize() {
        throw new PendingApprovalError();
      },
    });

    await expect(
      Auth(credentialsCallbackRequest(), {
        basePath: "/api/auth",
        providers: [provider],
        raw,
        secret: "test-authentication-secret-value-1234",
        skipCSRFCheck,
        trustHost: true,
      }),
    ).rejects.toMatchObject({
      code: "pending_approval",
      type: "CredentialsSignin",
    });
  });

  it("uses the generic credentials code when authorize returns null", async () => {
    const provider = Credentials({
      credentials: {},
      authorize() {
        return null;
      },
    });

    await expect(
      Auth(credentialsCallbackRequest(), {
        basePath: "/api/auth",
        providers: [provider],
        raw,
        secret: "test-authentication-secret-value-1234",
        skipCSRFCheck,
        trustHost: true,
      }),
    ).rejects.toMatchObject({
      code: "credentials",
      type: "CredentialsSignin",
    });
  });
});
