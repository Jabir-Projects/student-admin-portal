// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

import { emitAuthenticationDiagnostic } from "@/server/auth/diagnostics";

const originalVercelEnvironment = process.env.VERCEL_ENV;

afterEach(() => {
  if (originalVercelEnvironment === undefined) {
    delete process.env.VERCEL_ENV;
  } else {
    process.env.VERCEL_ENV = originalVercelEnvironment;
  }
  vi.restoreAllMocks();
});

describe("Preview authentication diagnostics", () => {
  it("emits fixed stage-only output in Vercel Preview", () => {
    process.env.VERCEL_ENV = "preview";
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    emitAuthenticationDiagnostic("authorize_password_valid");

    expect(info).toHaveBeenCalledExactlyOnceWith(
      "AUTH_DIAG authorize_password_valid",
    );
  });

  it("does not emit diagnostics outside Vercel Preview", () => {
    process.env.VERCEL_ENV = "production";
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    emitAuthenticationDiagnostic("authorize_password_valid");

    expect(info).not.toHaveBeenCalled();
  });
});
