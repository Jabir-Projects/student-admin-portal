const markerPayload = "sist-authenticated-session";
const markerVersion = "v1";
const signaturePattern = /^[0-9a-f]{64}$/u;

export const SESSION_HISTORY_COOKIE_NAME = "sist-auth-history";
export const SESSION_HISTORY_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

async function importSigningKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign", "verify"],
  );
}

function encodeHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function decodeHex(value: string): ArrayBuffer {
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }
  return bytes.buffer;
}

export async function createSessionHistoryMarker(
  secret: string,
): Promise<string> {
  if (secret.length < 32) {
    throw new Error("Invalid session history marker configuration.");
  }
  const key = await importSigningKey(secret);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(markerPayload),
  );
  return `${markerVersion}.${encodeHex(signature)}`;
}

export async function isValidSessionHistoryMarker(
  marker: string | undefined,
  secret: string | undefined,
): Promise<boolean> {
  if (!marker || !secret || secret.length < 32) return false;
  const [version, signature, extra] = marker.split(".");
  if (
    version !== markerVersion ||
    !signature ||
    extra !== undefined ||
    !signaturePattern.test(signature)
  ) {
    return false;
  }

  try {
    const key = await importSigningKey(secret);
    return await crypto.subtle.verify(
      "HMAC",
      key,
      decodeHex(signature),
      new TextEncoder().encode(markerPayload),
    );
  } catch {
    return false;
  }
}
