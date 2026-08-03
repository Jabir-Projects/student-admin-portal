// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import {
  FakeEmailProvider,
  ResendEmailProvider,
  createResendProviderFromEnvironment,
} from "@/server/notifications/provider.node";

const message = {
  to: "recipient@example.test",
  from: "SIST <notifications@example.test>",
  subject: "SIST notification",
  text: "Open the portal.",
  html: "<p>Open the portal.</p>",
  idempotencyKey: "email:event:test",
};

describe("email provider adapters", () => {
  it("deduplicates successful fake-provider submissions", async () => {
    const provider = new FakeEmailProvider();
    expect(await provider.send(message)).toEqual(await provider.send(message));
    expect(provider.submissions).toHaveLength(1);
  });

  it("supports deterministic transient failures", async () => {
    const provider = new FakeEmailProvider(2);
    expect(await provider.send(message)).toEqual({
      ok: false,
      errorCode: "FAKE_TRANSIENT_FAILURE",
    });
    expect(await provider.send(message)).toEqual({
      ok: false,
      errorCode: "FAKE_TRANSIENT_FAILURE",
    });
    expect((await provider.send(message)).ok).toBe(true);
  });

  it("sends Resend requests with a stable idempotency header", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "provider-message" }),
    });
    const provider = new ResendEmailProvider("test-only-key", fetcher);
    await expect(provider.send(message)).resolves.toEqual({
      ok: true,
      messageId: "provider-message",
    });
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        headers: expect.objectContaining({
          "Idempotency-Key": message.idempotencyKey,
        }),
      }),
    );
  });

  it("fails closed when provider configuration is absent", () => {
    expect(() => createResendProviderFromEnvironment({})).toThrow(
      "Email provider is not configured.",
    );
  });
});
