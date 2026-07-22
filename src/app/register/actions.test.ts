// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const actionMocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  registerStudent: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: actionMocks.redirect }));
vi.mock("@/server/auth/registration", () => ({
  registerStudent: actionMocks.registerStudent,
}));

import { registerAction } from "@/app/register/actions";

const redirectSignal = new Error("NEXT_REDIRECT_TEST_SIGNAL");
const expectedInput = {
  fullName: "Student Applicant",
  email: "student@example.com",
  password: "a secure password",
  confirmPassword: "a secure password",
  studentNumber: "SIST-123",
  program: "Foundation Year",
  academicYear: "FOUNDATION",
};

function registrationFormData(): FormData {
  const formData = new FormData();
  for (const [field, value] of Object.entries(expectedInput)) {
    formData.set(field, value);
  }
  formData.set("role", "ADMIN");
  formData.set("status", "ACTIVE");
  formData.set("source", "OFFICIAL_IMPORT");
  formData.set("registeredUserId", "attacker-controlled-id");
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  actionMocks.redirect.mockImplementation(() => {
    throw redirectSignal;
  });
});

describe("registration Server Action", () => {
  it("redirects successful registration and forwards only approved fields", async () => {
    actionMocks.registerStudent.mockResolvedValue({ ok: true });

    await expect(registerAction(registrationFormData())).rejects.toBe(
      redirectSignal,
    );
    expect(actionMocks.registerStudent).toHaveBeenCalledExactlyOnceWith(
      expectedInput,
    );
    expect(actionMocks.redirect).toHaveBeenCalledExactlyOnceWith(
      "/pending-approval?registered=1",
    );
  });

  it("redirects an expected registration failure to the generic invalid state", async () => {
    actionMocks.registerStudent.mockResolvedValue({
      ok: false,
      message:
        "The registration could not be submitted. Check the information or contact administration.",
    });

    await expect(registerAction(registrationFormData())).rejects.toBe(
      redirectSignal,
    );
    expect(actionMocks.redirect).toHaveBeenCalledExactlyOnceWith(
      "/register?error=invalid",
    );
  });

  it("maps an unexpected throw without logging payloads or raw errors", async () => {
    const privateFailure = new Error("private configuration detail");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    actionMocks.registerStudent.mockRejectedValue(privateFailure);

    try {
      await expect(registerAction(registrationFormData())).rejects.toBe(
        redirectSignal,
      );
      expect(actionMocks.redirect).toHaveBeenCalledExactlyOnceWith(
        "/register?error=invalid",
      );
      expect(errorSpy).not.toHaveBeenCalled();
      expect(logSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
      logSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });
});
