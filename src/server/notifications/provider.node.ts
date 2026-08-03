import "server-only";

export type EmailMessage = {
  to: string;
  from: string;
  subject: string;
  text: string;
  html: string;
  idempotencyKey: string;
};
export type EmailProviderResult =
  { ok: true; messageId: string } | { ok: false; errorCode: string };
export interface EmailProvider {
  send(message: EmailMessage): Promise<EmailProviderResult>;
}

function normalizeHttpError(status: number): string {
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "PROVIDER_UNAVAILABLE";
  if (status === 401 || status === 403) return "PROVIDER_AUTH_FAILED";
  return "PROVIDER_REJECTED";
}

export class ResendEmailProvider implements EmailProvider {
  constructor(
    private readonly apiKey: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    if (!apiKey.trim()) throw new Error("Email provider is not configured.");
  }
  async send(message: EmailMessage): Promise<EmailProviderResult> {
    try {
      const response = await this.fetcher("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": message.idempotencyKey,
        },
        body: JSON.stringify({
          from: message.from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          html: message.html,
        }),
      });
      if (!response.ok)
        return { ok: false, errorCode: normalizeHttpError(response.status) };
      const payload: unknown = await response.json();
      if (
        !payload ||
        typeof payload !== "object" ||
        !("id" in payload) ||
        typeof payload.id !== "string" ||
        !payload.id
      )
        return { ok: false, errorCode: "INVALID_PROVIDER_RESPONSE" };
      return { ok: true, messageId: payload.id.slice(0, 200) };
    } catch {
      return { ok: false, errorCode: "PROVIDER_UNAVAILABLE" };
    }
  }
}

export class FakeEmailProvider implements EmailProvider {
  readonly submissions: EmailMessage[] = [];
  private readonly results = new Map<string, EmailProviderResult>();
  constructor(private failuresBeforeSuccess = 0) {}
  async send(message: EmailMessage): Promise<EmailProviderResult> {
    const existing = this.results.get(message.idempotencyKey);
    if (existing?.ok) return existing;
    this.submissions.push(message);
    if (this.failuresBeforeSuccess > 0) {
      this.failuresBeforeSuccess -= 1;
      return { ok: false, errorCode: "FAKE_TRANSIENT_FAILURE" };
    }
    const result = {
      ok: true as const,
      messageId: `fake-${message.idempotencyKey}`.slice(0, 200),
    };
    this.results.set(message.idempotencyKey, result);
    return result;
  }
}

export function createResendProviderFromEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
): { provider: EmailProvider; from: string } {
  const apiKey = environment.RESEND_API_KEY?.trim();
  const from = environment.EMAIL_FROM?.trim();
  if (!apiKey || !from) throw new Error("Email provider is not configured.");
  return { provider: new ResendEmailProvider(apiKey), from };
}
