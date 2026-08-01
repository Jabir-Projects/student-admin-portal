import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/login/actions", () => ({ loginAction: vi.fn() }));

import LoginPage from "@/app/login/page";

afterEach(cleanup);

describe("login session-state presentation", () => {
  it.each([
    [
      "disabled",
      "This account is disabled. Contact an administrator if you believe this is an error.",
    ],
    ["session-ended", "Your session has ended. Sign in again to continue."],
  ])("presents the allowlisted %s reason", async (reason, message) => {
    render(await LoginPage({ searchParams: Promise.resolve({ reason }) }));

    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(screen.getByLabelText("Email")).toHaveAttribute(
      "aria-describedby",
      "login-error",
    );
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("presents a generic authentication failure without internal detail", async () => {
    render(
      await LoginPage({
        searchParams: Promise.resolve({ error: "CallbackRouteError" }),
      }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "The email address or password is incorrect.",
    );
    expect(
      screen.queryByText(/CallbackRouteError|stack|database/iu),
    ).toBeNull();
  });

  it("preserves a bounded callback request for server-side validation", async () => {
    const callbackUrl = "/staff/requests?status=open";
    const { container } = render(
      await LoginPage({
        searchParams: Promise.resolve({ callbackUrl }),
      }),
    );

    expect(
      container.querySelector('input[name="callbackUrl"]'),
    ).toHaveAttribute("value", callbackUrl);
  });

  it("does not preserve an oversized callback request", async () => {
    const { container } = render(
      await LoginPage({
        searchParams: Promise.resolve({
          callbackUrl: `/staff?value=${"x".repeat(2048)}`,
        }),
      }),
    );

    expect(container.querySelector('input[name="callbackUrl"]')).toBeNull();
  });

  it("replaces a suspicious bounded callback before form submission", async () => {
    const { container } = render(
      await LoginPage({
        searchParams: Promise.resolve({
          callbackUrl: " /staff",
        }),
      }),
    );

    expect(
      container.querySelector('input[name="callbackUrl"]'),
    ).toHaveAttribute("value", "/auth/continue");
  });
});
