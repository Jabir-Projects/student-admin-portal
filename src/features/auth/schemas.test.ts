import { describe, expect, it } from "vitest";

import { ACADEMIC_YEARS, PROGRAMS } from "@/features/auth/constants";
import {
  normalizeEmail,
  normalizeStudentNumber,
} from "@/features/auth/normalization";
import { loginSchema, registrationSchema } from "@/features/auth/schemas";

const validRegistration = {
  fullName: " Student Applicant ",
  email: " Student@Example.COM ",
  password: "a secure password",
  confirmPassword: "a secure password",
  studentNumber: " sist-123 ",
  program: PROGRAMS[0],
  academicYear: ACADEMIC_YEARS[0].value,
};

describe("authentication validation", () => {
  it("normalizes identifiers", () => {
    expect(normalizeEmail(" A@EXAMPLE.COM ")).toBe("a@example.com");
    expect(normalizeStudentNumber(" sist-1 ")).toBe("SIST-1");
  });
  it("accepts and normalizes an approved registration", () => {
    const result = registrationSchema.parse(validRegistration);
    expect(result.email).toBe("student@example.com");
    expect(result.studentNumber).toBe("SIST-123");
  });
  it("rejects unofficial programs, academic years, mismatched and oversized passwords", () => {
    expect(
      registrationSchema.safeParse({
        ...validRegistration,
        program: "Computer Science",
      }).success,
    ).toBe(false);
    expect(
      registrationSchema.safeParse({
        ...validRegistration,
        academicYear: "YEAR_4",
      }).success,
    ).toBe(false);
    expect(
      registrationSchema.safeParse({
        ...validRegistration,
        confirmPassword: "different password",
      }).success,
    ).toBe(false);
    expect(
      registrationSchema.safeParse({
        ...validRegistration,
        password: "x".repeat(129),
        confirmPassword: "x".repeat(129),
      }).success,
    ).toBe(false);
  });
  it("validates and normalizes login without disclosing account state", () => {
    expect(
      loginSchema.parse({ email: " A@EXAMPLE.COM ", password: "x" }),
    ).toEqual({ email: "a@example.com", password: "x" });
    expect(
      loginSchema.safeParse({ email: "invalid", password: "x" }).success,
    ).toBe(false);
    expect(
      loginSchema.safeParse({
        callbackUrl: "/auth/continue",
        email: "student@example.com",
        password: "x",
      }).success,
    ).toBe(false);
  });
});
