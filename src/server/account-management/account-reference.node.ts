import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";

import { accountReferenceSchema } from "@/features/account-management/schemas";

export type AccountReferencePurpose = "student" | "staff";
export type AccountReferenceResolution =
  { ok: true; accountId: string } | { ok: false; reason: "INVALID_REFERENCE" };

const referenceVersion = "acct2";
const payloadVersion = 2;
const encryptionAlgorithm = "aes-256-gcm";
const nonceLength = 12;
const authenticationTagLength = 16;
const keySalt = Buffer.from("sist-package-d-account-reference-key", "utf8");
const keyContext = Buffer.from(
  "sist-package-d-account-reference-v2-aes-256-gcm",
  "utf8",
);
const accountIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

type AccountReferencePayload = {
  v: typeof payloadVersion;
  p: AccountReferencePurpose;
  id: string;
};

function assertReferenceSecret(
  secret: string | undefined,
): asserts secret is string {
  if (typeof secret !== "string" || secret.length < 32) {
    throw new Error("Account reference secret is not configured safely.");
  }
}

function referenceKey(secret: string | undefined): Buffer {
  assertReferenceSecret(secret);
  return Buffer.from(
    hkdfSync("sha256", Buffer.from(secret, "utf8"), keySalt, keyContext, 32),
  );
}

function additionalAuthenticatedData(purpose: AccountReferencePurpose): Buffer {
  return Buffer.from(
    `sist-package-d-account-reference|${referenceVersion}|${purpose}`,
    "utf8",
  );
}

function isAccountReferencePayload(
  value: unknown,
  expectedPurpose: AccountReferencePurpose,
): value is AccountReferencePayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const payload = value as Record<string, unknown>;
  return (
    Object.keys(payload).length === 3 &&
    payload.v === payloadVersion &&
    payload.p === expectedPurpose &&
    typeof payload.id === "string" &&
    accountIdPattern.test(payload.id)
  );
}

export function createAccountReference(
  purpose: AccountReferencePurpose,
  accountId: string,
  secret: string | undefined,
): string {
  const key = referenceKey(secret);
  if (!accountIdPattern.test(accountId)) {
    throw new Error("Cannot create an account reference for an invalid ID.");
  }

  const payload: AccountReferencePayload = {
    v: payloadVersion,
    p: purpose,
    id: accountId,
  };
  const nonce = randomBytes(nonceLength);
  const cipher = createCipheriv(encryptionAlgorithm, key, nonce, {
    authTagLength: authenticationTagLength,
  });
  cipher.setAAD(additionalAuthenticatedData(purpose));
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const envelope = Buffer.concat([nonce, ciphertext, cipher.getAuthTag()]);
  return `${referenceVersion}.${envelope.toString("base64url")}`;
}

export function resolveAccountReference(
  reference: string,
  expectedPurpose: AccountReferencePurpose,
  secret: string | undefined,
): AccountReferenceResolution {
  const key = referenceKey(secret);
  if (!accountReferenceSchema.safeParse(reference).success) {
    return { ok: false, reason: "INVALID_REFERENCE" };
  }

  const [version, encodedEnvelope] = reference.split(".");
  if (version !== referenceVersion || !encodedEnvelope) {
    return { ok: false, reason: "INVALID_REFERENCE" };
  }

  try {
    const envelope = Buffer.from(encodedEnvelope, "base64url");
    if (
      envelope.toString("base64url") !== encodedEnvelope ||
      envelope.length <= nonceLength + authenticationTagLength
    ) {
      return { ok: false, reason: "INVALID_REFERENCE" };
    }

    const nonce = envelope.subarray(0, nonceLength);
    const authenticationTag = envelope.subarray(-authenticationTagLength);
    const ciphertext = envelope.subarray(nonceLength, -authenticationTagLength);
    const decipher = createDecipheriv(encryptionAlgorithm, key, nonce, {
      authTagLength: authenticationTagLength,
    });
    decipher.setAAD(additionalAuthenticatedData(expectedPurpose));
    decipher.setAuthTag(authenticationTag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
    const payload: unknown = JSON.parse(plaintext);
    if (!isAccountReferencePayload(payload, expectedPurpose)) {
      return { ok: false, reason: "INVALID_REFERENCE" };
    }
    return { ok: true, accountId: payload.id };
  } catch {
    return { ok: false, reason: "INVALID_REFERENCE" };
  }
}
