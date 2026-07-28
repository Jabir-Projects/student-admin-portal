import { describe, expect, it } from "vitest";

import {
  createSessionHistoryMarker,
  isValidSessionHistoryMarker,
} from "@/features/auth/session-marker";

const authenticationSecret = "test-authentication-secret-value-1234";

describe("server-managed session history evidence", () => {
  it("accepts only a marker authenticated by the server secret", async () => {
    const marker = await createSessionHistoryMarker(authenticationSecret);

    await expect(
      isValidSessionHistoryMarker(marker, authenticationSecret),
    ).resolves.toBe(true);
  });

  it.each([
    undefined,
    "",
    "v1.invalid",
    "browser-created-value",
    "v2.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  ])("rejects absent or arbitrary browser evidence %s", async (marker) => {
    await expect(
      isValidSessionHistoryMarker(marker, authenticationSecret),
    ).resolves.toBe(false);
  });

  it("rejects a marker changed after the server issued it", async () => {
    const marker = await createSessionHistoryMarker(authenticationSecret);
    const replacement = marker.endsWith("0") ? "1" : "0";
    const tamperedMarker = `${marker.slice(0, -1)}${replacement}`;

    await expect(
      isValidSessionHistoryMarker(tamperedMarker, authenticationSecret),
    ).resolves.toBe(false);
  });

  it("rejects a valid marker when the server secret is unavailable", async () => {
    const marker = await createSessionHistoryMarker(authenticationSecret);

    await expect(isValidSessionHistoryMarker(marker, undefined)).resolves.toBe(
      false,
    );
  });
});
