import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { RegistrationForm } from "@/app/register/registration-form";

afterEach(cleanup);

describe("RegistrationForm", () => {
  it("provides controlled English errors and accessibility semantics for invalid submission", () => {
    render(<RegistrationForm action={() => undefined} />);

    fireEvent.submit(
      screen
        .getByRole("button", { name: "Submit registration" })
        .closest("form")!,
    );

    expect(
      screen.getByText("Password must contain at least 12 characters."),
    ).toHaveAttribute("role", "alert");
    const password = document.querySelector('input[name="password"]');
    expect(password).toHaveAttribute("aria-invalid", "true");
    expect(password).toHaveAttribute("aria-describedby", "password-error");
  });

  it("announces a mismatched confirmation without submitting the form", () => {
    let submissionCount = 0;
    const action = () => {
      submissionCount += 1;
    };
    render(<RegistrationForm action={action} />);

    populateValidFields();
    fireEvent.change(document.querySelector('input[name="password"]')!, {
      target: { value: "correct-password" },
    });
    fireEvent.change(document.querySelector('input[name="confirmPassword"]')!, {
      target: { value: "different-password" },
    });
    fireEvent.submit(
      screen
        .getByRole("button", { name: "Submit registration" })
        .closest("form")!,
    );

    expect(screen.getByText("Passwords do not match.")).toHaveAttribute(
      "role",
      "alert",
    );
    expect(
      document.querySelector('input[name="confirmPassword"]'),
    ).toHaveAttribute("aria-invalid", "true");
    expect(submissionCount).toBe(0);
  });
});

function populateValidFields() {
  fireEvent.change(document.querySelector('input[name="fullName"]')!, {
    target: { value: "Test Student" },
  });
  fireEvent.change(document.querySelector('input[name="email"]')!, {
    target: { value: "student@example.test" },
  });
  fireEvent.change(document.querySelector('input[name="studentNumber"]')!, {
    target: { value: "REG-TEST-001" },
  });
  fireEvent.change(document.querySelector('select[name="program"]')!, {
    target: { value: "Foundation Year" },
  });
  fireEvent.change(document.querySelector('select[name="academicYear"]')!, {
    target: { value: "FOUNDATION" },
  });
}
