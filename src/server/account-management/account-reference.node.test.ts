// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  createAccountReference,
  resolveAccountReference,
} from "@/server/account-management/account-reference.node";

const secret = "test-only-account-reference-secret".repeat(2);
const accountId = "40000000-0000-4000-8000-000000000001";

function decodedTokenComponents(reference: string): string {
  return reference
    .split(".")
    .map((component) => Buffer.from(component, "base64url").toString("utf8"))
    .join("|");
}

function mutateEnvelopeByte(reference: string, index: number): string {
  const [version, encodedEnvelope] = reference.split(".");
  if (!version || !encodedEnvelope) throw new Error("Invalid test reference.");
  const envelope = Buffer.from(encodedEnvelope, "base64url");
  envelope[index] = (envelope[index] ?? 0) ^ 1;
  return `${version}.${envelope.toString("base64url")}`;
}

describe("opaque account references", () => {
  it("encrypts the identifier and resolves it only inside the server boundary", () => {
    const studentReference = createAccountReference(
      "student",
      accountId,
      secret,
    );
    const staffReference = createAccountReference("staff", accountId, secret);

    for (const reference of [studentReference, staffReference]) {
      expect(reference).not.toBe(accountId);
      expect(reference).not.toContain(accountId);
      expect(
        Buffer.from(reference, "base64url").toString("utf8"),
      ).not.toContain(accountId);
      expect(decodedTokenComponents(reference)).not.toContain(accountId);
    }
    expect(
      resolveAccountReference(studentReference, "student", secret),
    ).toEqual({
      ok: true,
      accountId,
    });
    expect(resolveAccountReference(staffReference, "staff", secret)).toEqual({
      ok: true,
      accountId,
    });
  });

  it("uses a fresh nonce for every reference", () => {
    expect(createAccountReference("student", accountId, secret)).not.toBe(
      createAccountReference("student", accountId, secret),
    );
  });

  it("rejects nonce, ciphertext, tag, and version tampering", () => {
    const reference = createAccountReference("student", accountId, secret);
    const [, encodedEnvelope] = reference.split(".");
    if (!encodedEnvelope) throw new Error("Invalid test reference.");
    const envelopeLength = Buffer.from(encodedEnvelope, "base64url").length;

    for (const tampered of [
      mutateEnvelopeByte(reference, 0),
      mutateEnvelopeByte(reference, 12),
      mutateEnvelopeByte(reference, envelopeLength - 1),
      reference.replace(/^acct2\./u, "acct3."),
    ]) {
      expect(resolveAccountReference(tampered, "student", secret)).toEqual({
        ok: false,
        reason: "INVALID_REFERENCE",
      });
    }
  });

  it("rejects malformed, truncated, oversized, and invalid encodings", () => {
    const reference = createAccountReference("student", accountId, secret);
    const [version, encodedEnvelope] = reference.split(".");
    if (!version || !encodedEnvelope)
      throw new Error("Invalid test reference.");
    const truncated = Buffer.from(encodedEnvelope, "base64url")
      .subarray(0, -1)
      .toString("base64url");

    for (const invalid of [
      "malformed",
      `${version}.${truncated}`,
      `${version}.${"a".repeat(300)}`,
      `${version}.***`,
    ]) {
      expect(resolveAccountReference(invalid, "student", secret)).toEqual({
        ok: false,
        reason: "INVALID_REFERENCE",
      });
    }
  });

  it("rejects references encrypted with another secret", () => {
    const reference = createAccountReference("student", accountId, secret);
    expect(
      resolveAccountReference(reference, "student", "wrong-secret".repeat(4))
        .ok,
    ).toBe(false);
  });

  it("does not interchange student and STAFF references", () => {
    const studentReference = createAccountReference(
      "student",
      accountId,
      secret,
    );
    const staffReference = createAccountReference("staff", accountId, secret);
    expect(resolveAccountReference(studentReference, "staff", secret)).toEqual({
      ok: false,
      reason: "INVALID_REFERENCE",
    });
    expect(resolveAccountReference(staffReference, "student", secret)).toEqual({
      ok: false,
      reason: "INVALID_REFERENCE",
    });
  });

  it("rejects invalid IDs and missing or weak secrets", () => {
    expect(() => createAccountReference("staff", "raw-id", secret)).toThrow();
    expect(() => createAccountReference("staff", accountId, "short")).toThrow();
    expect(() => createAccountReference("staff", accountId, undefined)).toThrow(
      "Account reference secret is not configured safely.",
    );
    const reference = createAccountReference("staff", accountId, secret);
    expect(() =>
      resolveAccountReference(reference, "staff", undefined),
    ).toThrow("Account reference secret is not configured safely.");
  });
});
